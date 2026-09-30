/**
 * SERVICE MONTHS — the agency's accounting (Esther, Sept 30 2026).
 *
 * A client's agenda is organised by service month, not by the date of the activity: MES 1 is the
 * client's first month with us and holds its first `monthlyTarget` goals, MES 2 the next
 * `monthlyTarget`, and so on — "sin importar en qué fecha exacta se hayan creado o agendado".
 * Goals fill the months in the order they entered the ledger: the imported history first (in
 * the order of the Google Doc), then everything closed in the portal by closing time.
 *
 * Units of accounting: every non-cancelled pauta (with or without a goal) and every closed goal
 * that has no pauta. Pinned units (a month picked by hand, or a month imported from the doc)
 * stay where they are and simply occupy a slot.
 *
 * reconcileClientMonths() recomputes and PERSISTS the month on goals (Deliverable.month/year) and
 * pautas (RunnerAssignment.agendaMonth/Year), so every view (client agenda, portal agenda, Google
 * Doc append, dashboard, reports) reads the same answer. Called after any change to a client's
 * goals or agenda, and nightly for every active client.
 */
import { db } from "@/lib/db";
import { CLOSED_GOAL_STATUSES } from "@/lib/goal-status";
import { dayKeyInTz } from "@/components/runners/miami-time";

export type MonthKey = { year: number; month: number };
const idx = (m: MonthKey) => m.year * 12 + (m.month - 1);
const fromIdx = (i: number): MonthKey => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });
const calendarOf = (d: Date): MonthKey => { const [y, m] = dayKeyInTz(d).split("-").map(Number); return { year: y, month: m }; };

type Unit = {
  pautaId: string | null;
  goalId: string | null;
  /** Sort key: [rank, time] — history (rank 0) before portal-closed goals (rank 1). */
  rank: 0 | 1;
  time: number;
  seq: number;
  /** Fixed month (hand-picked or from the ledger). */
  pinned: MonthKey | null;
  /** Calendar month of the activity (used only when the client has no target). */
  calendar: MonthKey;
};

export type ServiceMonthPlan = {
  target: number;
  start: MonthKey | null;
  units: (Unit & { assigned: MonthKey })[];
  counts: Map<string, number>;
};

export async function planServiceMonths(clientId: string): Promise<ServiceMonthPlan | null> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { monthlyTarget: true, serviceStartYear: true, serviceStartMonth: true } });
  if (!client) return null;
  const target = Math.max(0, client.monthlyTarget ?? 0);

  const [pautas, goals] = await Promise.all([
    db.runnerAssignment.findMany({
      where: { clientId, status: { not: "CANCELLED" } },
      select: { id: true, deliverableId: true, eventDate: true, createdAt: true, agendaSequence: true, agendaMonth: true, agendaYear: true, agendaMonthPinned: true },
    }),
    db.deliverable.findMany({
      where: { clientId, status: { in: [...CLOSED_GOAL_STATUSES] }, isInternal: false },
      select: { id: true, closedAt: true, completedAt: true, createdAt: true, dueDate: true, month: true, year: true, monthPinned: true },
    }),
  ]);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const unitsRaw: Unit[] = [];
  const usedGoals = new Set<string>();
  for (const p of pautas) {
    const g = p.deliverableId ? goalById.get(p.deliverableId) : undefined;
    if (g) usedGoals.add(g.id);
    const legacy = p.id.startsWith("agimp_");
    const pinned = g?.monthPinned ? { year: g.year, month: g.month } : p.agendaMonthPinned && p.agendaMonth && p.agendaYear ? { year: p.agendaYear, month: p.agendaMonth } : null;
    unitsRaw.push({
      pautaId: p.id,
      goalId: g?.id ?? null,
      rank: legacy ? 0 : 1,
      time: legacy ? p.eventDate.getTime() : (g?.closedAt ?? g?.createdAt ?? p.createdAt).getTime(),
      seq: p.agendaSequence ?? 0,
      pinned,
      calendar: calendarOf(p.eventDate),
    });
  }
  for (const g of goals) {
    if (usedGoals.has(g.id)) continue;
    unitsRaw.push({
      pautaId: null,
      goalId: g.id,
      rank: 1,
      time: (g.closedAt ?? g.completedAt ?? g.createdAt).getTime(),
      seq: 0,
      pinned: g.monthPinned ? { year: g.year, month: g.month } : null,
      calendar: calendarOf(g.dueDate ?? g.closedAt ?? g.createdAt),
    });
  }
  const units = unitsRaw.sort((a, b) => a.rank - b.rank || a.time - b.time || a.seq - b.seq);

  const counts = new Map<string, number>();
  const bump = (m: MonthKey) => counts.set(`${m.year}-${m.month}`, (counts.get(`${m.year}-${m.month}`) ?? 0) + 1);

  // No target: plain calendar months (pins still honoured).
  if (target <= 0 || units.length === 0) {
    const out = units.map((u) => ({ ...u, assigned: u.pinned ?? u.calendar }));
    out.forEach((u) => bump(u.assigned));
    return { target, start: null, units: out, counts };
  }

  // MES 1 = the stored service start; else the earliest ledger month when the doc was imported;
  // else the month of the first activity (a first activity in the last 3 days of a month whose
  // next one is already in the following month means the service started that next month —
  // Jonathan Moly: Jul 31 + Aug 6 → AGOSTO). Persisted by reconcile.
  let start: MonthKey;
  if (client.serviceStartYear && client.serviceStartMonth) start = { year: client.serviceStartYear, month: client.serviceStartMonth };
  else {
    // Only ledger pins (months imported from the doc) define the start; hand-pinned goals do not.
    const ledgerIdx = pautas.filter((p) => p.agendaMonthPinned && p.agendaMonth && p.agendaYear).map((p) => idx({ year: p.agendaYear!, month: p.agendaMonth! }));
    if (ledgerIdx.length) start = fromIdx(Math.min(...ledgerIdx));
    else {
      const first = units[0].calendar;
      const firstDay = Number(dayKeyInTz(new Date(units[0].time)).slice(8, 10));
      const second = units[1]?.calendar;
      const daysInMonth = new Date(first.year, first.month, 0).getDate();
      start = units[0].rank === 0 && second && idx(second) === idx(first) + 1 && daysInMonth - firstDay < 3 ? second : first;
    }
  }

  for (const u of units) if (u.pinned) bump(u.pinned);
  let m = idx(start);
  const out = units.map((u) => {
    if (u.pinned) return { ...u, assigned: u.pinned };
    while ((counts.get(`${fromIdx(m).year}-${fromIdx(m).month}`) ?? 0) >= target) m++;
    const assigned = fromIdx(m);
    bump(assigned);
    return { ...u, assigned };
  });
  return { target, start, units: out, counts };
}

/** Recompute and persist the service month of every goal and pauta of a client. Returns how many rows changed. */
export async function reconcileClientMonths(clientId: string): Promise<number> {
  const plan = await planServiceMonths(clientId);
  if (!plan) return 0;
  let changed = 0;
  if (plan.start) {
    await db.client.updateMany({ where: { id: clientId, serviceStartYear: null }, data: { serviceStartYear: plan.start.year, serviceStartMonth: plan.start.month } });
  }
  const pautaIds = plan.units.map((u) => u.pautaId).filter((x): x is string => !!x);
  const goalIds = plan.units.map((u) => u.goalId).filter((x): x is string => !!x);
  const [pautas, goals] = await Promise.all([
    db.runnerAssignment.findMany({ where: { id: { in: pautaIds } }, select: { id: true, agendaMonth: true, agendaYear: true } }),
    db.deliverable.findMany({ where: { id: { in: goalIds } }, select: { id: true, month: true, year: true } }),
  ]);
  const pm = new Map(pautas.map((p) => [p.id, p]));
  const gm = new Map(goals.map((g) => [g.id, g]));
  for (const u of plan.units) {
    const { year, month } = u.assigned;
    if (u.pautaId) {
      const p = pm.get(u.pautaId);
      if (p && (p.agendaMonth !== month || p.agendaYear !== year)) {
        await db.runnerAssignment.update({ where: { id: u.pautaId }, data: { agendaMonth: month, agendaYear: year } });
        changed++;
      }
    }
    if (u.goalId) {
      const g = gm.get(u.goalId);
      if (g && (g.month !== month || g.year !== year)) {
        await db.deliverable.update({ where: { id: u.goalId }, data: { month, year } });
        changed++;
      }
    }
  }
  return changed;
}

/** Fire-and-forget variant for request handlers: never fails the request. */
export async function reconcileSafely(clientId: string | null | undefined): Promise<void> {
  if (!clientId) return;
  try {
    await reconcileClientMonths(clientId);
  } catch (err) {
    console.error("reconcileClientMonths failed:", err);
  }
}

/**
 * Goals per service month for the dashboard / reports: closed goals tagged with the month PLUS
 * history pautas (no goal) whose ledger month is that month — the same units the agenda shows.
 */
export async function unitCountsForMonth(clientIds: string[], month: number, year: number): Promise<Map<string, number>> {
  const [goals, pautas] = await Promise.all([
    db.deliverable.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, month, year, status: { in: [...CLOSED_GOAL_STATUSES] }, isInternal: false }, _count: { _all: true } }),
    db.runnerAssignment.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, deliverableId: null, status: { not: "CANCELLED" }, agendaMonth: month, agendaYear: year }, _count: { _all: true } }),
  ]);
  const out = new Map<string, number>();
  for (const g of goals) out.set(g.clientId, (out.get(g.clientId) ?? 0) + g._count._all);
  for (const p of pautas) if (p.clientId) out.set(p.clientId, (out.get(p.clientId) ?? 0) + p._count._all);
  return out;
}
