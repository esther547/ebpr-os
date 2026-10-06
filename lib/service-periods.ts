/**
 * SERVICE PERIODS — the client's accounting unit (Esther, Oct 1 2026).
 *
 * A client's agenda is organised by consecutive service periods ("Mes 1", "Mes 2"…), each with the
 * goals agreed for it. Periods are assigned by hand and do not have to be consecutive calendar
 * months (Grace: Mes 1 = mayo, Mes 2 = septiembre). A unit (a pauta, with or without a goal, or a
 * closed goal without a pauta) belongs to exactly one period, or to none while the admin reviews it.
 *
 * THE RULE (Esther, Oct 2 2026): a period is a monthly account of achievements OBTAINED during it.
 * A pauta belongs to the period in which it was secured/closed — never to the month in which it
 * is executed ("conseguida el 25 de julio, evento el 1 de agosto → julio"). Each pauta is worth
 * `goalValue` goals (1 by default, 2+ for a big win), so 5 pautas can make 6/6.
 *
 * Moving an event's date never changes its period; executing a closed goal updates its status
 * without moving it or counting it twice; one activity may cover a whole period when the client
 * agreed to it (coversPeriod + note). A new unit goes to the period of its closing month; when
 * that one is already complete it goes to the next period with room (created if needed).
 */
import { db } from "@/lib/db";
import { CLOSED_GOAL_STATUSES, isClosedGoal } from "@/lib/goal-status";
import { MONTH_NAMES_ES } from "@/lib/agenda-months";
import { dayKeyInTz } from "@/components/runners/miami-time";

export type PeriodDTO = { id: string; number: number; label: string; refYear: number; refMonth: number; target: number; note: string | null };

/** Status of a unit inside its period, as the team and the client read it. */
export type UnitState = "scheduled" | "closed_pending" | "executed" | "cancelled";

export type PeriodUnit = {
  key: string;
  pautaId: string | null;
  goalId: string | null;
  title: string;
  eventDate: Date | null;
  closedAt: Date | null;
  executedAt: Date | null;
  state: UnitState;
  coversPeriod: boolean;
  periodNote: string | null;
  periodId: string | null;
  /** Goals this pauta is worth by itself (1, 2, 3…). */
  goalValue: number;
  /** Goals it counts for in its period (goalValue, or the period's target when it covers the period). */
  weight: number;
  /** "manual" | "closing" | "history" | null — see the schema. */
  periodSource: string | null;
  /** Standout achievement ("GOLD"). */
  isGold: boolean;
  /** No closing date and nobody confirmed the period yet (Esther: flag, don't guess). */
  needsReview: boolean;
};

export const periodSelect = { id: true, number: true, label: true, refYear: true, refMonth: true, target: true, note: true } as const;

export function periodTitle(p: { number: number; label: string }): string {
  return `Mes ${p.number} · ${p.label}`;
}

export function defaultLabel(refYear: number, refMonth: number): string {
  const n = MONTH_NAMES_ES[refMonth - 1];
  return `${n.charAt(0)}${n.slice(1).toLowerCase()} ${refYear}`;
}

export async function listPeriods(clientId: string): Promise<PeriodDTO[]> {
  return db.servicePeriod.findMany({ where: { clientId }, select: periodSelect, orderBy: { number: "asc" } });
}

function stateOf(status: string | null | undefined, pautaStatus: string | null | undefined, hasGoal: boolean): UnitState {
  if (status === "CANCELLED" || pautaStatus === "CANCELLED") return "cancelled";
  if (hasGoal) {
    // Executed when the goal is completed OR the pauta itself was marked done (runner / team).
    if (status === "COMPLETED" || pautaStatus === "COMPLETED") return "executed";
    if (status && isClosedGoal(status)) return "closed_pending";
    return "scheduled";
  }
  return pautaStatus === "COMPLETED" ? "executed" : "scheduled";
}

/** Every unit of a client with its period, plus the pending ones. */
export async function clientUnits(clientId: string): Promise<PeriodUnit[]> {
  const [pautas, goals] = await Promise.all([
    db.runnerAssignment.findMany({
      // Proposals ("Pending" rows) are not confirmed opportunities: they never count.
      where: { clientId, status: { not: "CANCELLED" }, isProposal: false },
      select: { id: true, deliverableId: true, eventName: true, eventDate: true, status: true, periodId: true, coversPeriod: true, periodNote: true, goalValue: true, periodSource: true, isGold: true, createdAt: true },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    }),
    db.deliverable.findMany({
      where: { clientId, status: { in: [...CLOSED_GOAL_STATUSES] }, isInternal: false },
      select: { id: true, title: true, status: true, dueDate: true, closedAt: true, completedAt: true, periodId: true, coversPeriod: true, periodNote: true, goalValue: true, periodSource: true, isGold: true, createdAt: true },
    }),
  ]);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const used = new Set<string>();
  const units: PeriodUnit[] = [];
  for (const p of pautas) {
    const g = p.deliverableId ? goalById.get(p.deliverableId) : undefined;
    if (g) used.add(g.id);
    units.push({
      key: `p:${p.id}`,
      pautaId: p.id,
      goalId: g?.id ?? null,
      title: g?.title ?? p.eventName,
      eventDate: p.eventDate,
      closedAt: g?.closedAt ?? null,
      executedAt: g?.completedAt ?? (p.status === "COMPLETED" ? p.eventDate : null),
      state: stateOf(g?.status, p.status, !!g),
      coversPeriod: g?.coversPeriod ?? p.coversPeriod,
      periodNote: g?.periodNote ?? p.periodNote,
      periodId: g?.periodId ?? p.periodId,
      goalValue: Math.max(g?.goalValue ?? 1, p.goalValue ?? 1),
      weight: Math.max(g?.goalValue ?? 1, p.goalValue ?? 1),
      periodSource: g?.periodSource ?? p.periodSource ?? null,
      isGold: !!(g?.isGold || p.isGold),
      needsReview: !(g?.closedAt) && (g?.periodSource ?? p.periodSource) !== "manual",
    });
  }
  for (const g of goals) {
    if (used.has(g.id)) continue;
    units.push({
      key: `g:${g.id}`,
      pautaId: null,
      goalId: g.id,
      title: g.title,
      eventDate: g.dueDate,
      closedAt: g.closedAt,
      executedAt: g.completedAt,
      state: stateOf(g.status, null, true),
      coversPeriod: g.coversPeriod,
      periodNote: g.periodNote,
      periodId: g.periodId,
      goalValue: g.goalValue ?? 1,
      weight: g.goalValue ?? 1,
      periodSource: g.periodSource ?? null,
      isGold: g.isGold,
      needsReview: !g.closedAt && g.periodSource !== "manual",
    });
  }
  return units;
}

export type PeriodView = PeriodDTO & { units: PeriodUnit[]; achieved: number; closedPending: number; executed: number; missing: number; toReview: number };

/** Periods with their units and progress; `pending` = units nobody has placed yet. */
export async function periodBoard(clientId: string): Promise<{ periods: PeriodView[]; pending: PeriodUnit[] }> {
  const [periods, units] = await Promise.all([listPeriods(clientId), clientUnits(clientId)]);
  const byPeriod = new Map<string, PeriodUnit[]>();
  const pending: PeriodUnit[] = [];
  for (const u of units) {
    if (u.periodId && periods.some((p) => p.id === u.periodId)) byPeriod.set(u.periodId, [...(byPeriod.get(u.periodId) ?? []), u]);
    else pending.push(u);
  }
  const views = periods.map((p) => {
    const list = (byPeriod.get(p.id) ?? []).map((u) => ({ ...u, weight: u.coversPeriod ? Math.max(p.target, u.goalValue) : u.goalValue }));
    // Total goals achieved = the sum of each pauta's value (5 pautas can make 6/6).
    const achieved = list.reduce((s, u) => s + u.weight, 0);
    return {
      ...p,
      units: list,
      achieved,
      closedPending: list.filter((u) => u.state === "closed_pending").length,
      executed: list.filter((u) => u.state === "executed").length,
      missing: Math.max(0, p.target - achieved),
      toReview: list.filter((u) => u.needsReview).length,
    };
  });
  return { periods: views, pending };
}

const monthIdx = (year: number, month: number) => year * 12 + (month - 1);

/**
 * Where a unit secured on `closedAt` belongs: the period of that calendar month (Miami); when that
 * period is already complete, the next one with room. When no period exists for it, the next
 * consecutive period is created (client's monthly target) — never an intermediate one.
 */
export async function defaultPeriodFor(clientId: string, closedAt: Date = new Date()): Promise<string | null> {
  const [board, client] = await Promise.all([periodBoard(clientId), db.client.findUnique({ where: { id: clientId }, select: { monthlyTarget: true } })]);
  const [cy, cm] = dayKeyInTz(closedAt).split("-").map(Number);
  const closing = monthIdx(cy, cm);
  const hasRoom = (p: PeriodView) => p.target === 0 || p.achieved < p.target;
  const candidate = board.periods.find((p) => monthIdx(p.refYear, p.refMonth) >= closing && hasRoom(p));
  if (candidate) return candidate.id;
  // Nothing at or after the closing month has room: open the next period.
  const last = board.periods[board.periods.length - 1];
  const nextIdx = last ? Math.max(closing, monthIdx(last.refYear, last.refMonth) + 1) : closing;
  const refYear = Math.floor(nextIdx / 12);
  const refMonth = (nextIdx % 12) + 1;
  const created = await db.servicePeriod.create({
    data: { clientId, number: (last?.number ?? 0) + 1, label: defaultLabel(refYear, refMonth), refYear, refMonth, target: client?.monthlyTarget ?? 0 },
    select: { id: true },
  });
  return created.id;
}

/** Place a unit (by pauta or goal) in a period — or in none. Keeps pauta + goal in sync and the derived month fields. */
export async function assignPeriod(
  ref: { pautaId?: string | null; goalId?: string | null },
  periodId: string | null,
  extra: { coversPeriod?: boolean; periodNote?: string | null; goalValue?: number; source?: "manual" | "closing" | "history"; isGold?: boolean } = {}
): Promise<void> {
  const period = periodId ? await db.servicePeriod.findUnique({ where: { id: periodId }, select: { id: true, refYear: true, refMonth: true } }) : null;
  const data = { periodId: period?.id ?? null, ...(extra.source !== undefined ? { periodSource: extra.source } : {}), ...(extra.coversPeriod !== undefined ? { coversPeriod: extra.coversPeriod } : {}), ...(extra.periodNote !== undefined ? { periodNote: extra.periodNote } : {}), ...(extra.goalValue !== undefined ? { goalValue: Math.max(1, Math.min(20, Math.round(extra.goalValue))) } : {}), ...(extra.isGold !== undefined ? { isGold: extra.isGold } : {}) };
  let pautaId = ref.pautaId ?? null;
  let goalId = ref.goalId ?? null;
  if (pautaId && !goalId) goalId = (await db.runnerAssignment.findUnique({ where: { id: pautaId }, select: { deliverableId: true } }))?.deliverableId ?? null;
  if (goalId && !pautaId) pautaId = (await db.runnerAssignment.findFirst({ where: { deliverableId: goalId }, select: { id: true } }))?.id ?? null;
  if (pautaId) {
    await db.runnerAssignment.update({ where: { id: pautaId }, data: { ...data, ...(period ? { agendaMonth: period.refMonth, agendaYear: period.refYear } : {}) } });
  }
  if (goalId) {
    await db.deliverable.update({ where: { id: goalId }, data: { ...data, ...(period ? { month: period.refMonth, year: period.refYear, monthPinned: true } : {}) } });
  }
}

/** New unit: the period of the month it was secured in (or the next with room). Never moves anything already placed. */
export async function placeNewUnit(clientId: string | null | undefined, ref: { pautaId?: string | null; goalId?: string | null }, closedAt?: Date | null): Promise<void> {
  if (!clientId) return;
  try {
    let when = closedAt ?? null;
    if (!when) {
      const goalId = ref.goalId ?? (ref.pautaId ? (await db.runnerAssignment.findUnique({ where: { id: ref.pautaId }, select: { deliverableId: true } }))?.deliverableId : null);
      if (goalId) when = (await db.deliverable.findUnique({ where: { id: goalId }, select: { closedAt: true } }))?.closedAt ?? null;
    }
    const periodId = await defaultPeriodFor(clientId, when ?? new Date());
    await assignPeriod(ref, periodId, { source: when ? "closing" : "history" });
  } catch (err) {
    console.error("placeNewUnit failed:", err);
  }
}

/**
 * THE DISTRIBUTION (Esther, Oct 5 2026). Deterministic and re-runnable:
 *  1. units placed by hand ("manual") and units without a closing date ("history", flagged for
 *     review) keep their period and occupy their slots first;
 *  2. confirmed opportunities WITH a closing date are ordered by that date and fill the period of
 *     their closing month; when it is complete (sum of values ≥ target) they go to the next period
 *     with room, created if needed — never an earlier one;
 *  3. each opportunity counts once; event dates are never touched.
 * Running it again with the same data changes nothing. Returns how many units moved.
 */
export async function redistributeClient(clientId: string): Promise<number> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { monthlyTarget: true } });
  if (!client) return 0;
  let periods = await db.servicePeriod.findMany({ where: { clientId }, orderBy: { number: "asc" }, select: { id: true, number: true, refYear: true, refMonth: true, target: true } });
  const units = await clientUnits(clientId);
  const weightOf = (u: PeriodUnit, target: number) => (u.coversPeriod ? Math.max(target, u.goalValue) : u.goalValue);
  const load = new Map<string, number>();
  const bump = (pid: string, w: number) => load.set(pid, (load.get(pid) ?? 0) + w);
  const movable: PeriodUnit[] = [];
  for (const u of units) {
    const fixed = u.periodSource === "manual" || !u.closedAt;
    if (fixed) { if (u.periodId) bump(u.periodId, weightOf(u, periods.find((p) => p.id === u.periodId)?.target ?? 0)); }
    else movable.push(u);
  }
  movable.sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime() || a.key.localeCompare(b.key));
  let moved = 0;
  for (const u of movable) {
    const [cy, cm] = dayKeyInTz(u.closedAt!).split("-").map(Number);
    const closing = monthIdx(cy, cm);
    // A unit only goes where it fits completely, so no month ever exceeds its agreed goals.
    let target = periods.find((p) => monthIdx(p.refYear, p.refMonth) >= closing && (p.target === 0 || (load.get(p.id) ?? 0) + weightOf(u, p.target) <= p.target));
    if (!target) {
      const last = periods[periods.length - 1];
      const nextIdx = last ? Math.max(closing, monthIdx(last.refYear, last.refMonth) + 1) : closing;
      const refYear = Math.floor(nextIdx / 12); const refMonth = (nextIdx % 12) + 1;
      target = await db.servicePeriod.create({ data: { clientId, number: (last?.number ?? 0) + 1, label: defaultLabel(refYear, refMonth), refYear, refMonth, target: client.monthlyTarget ?? 0 }, select: { id: true, number: true, refYear: true, refMonth: true, target: true } });
      periods = [...periods, target];
    }
    bump(target.id, weightOf(u, target.target));
    if (u.periodId !== target.id || u.periodSource !== "closing") {
      await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, target.id, { source: "closing" });
      if (u.periodId !== target.id) moved++;
    }
  }
  return moved;
}

/** Progress per client for the period whose reference month is (year, month) — reports and dashboard. */
export async function periodProgressForMonth(clientIds: string[], month: number, year: number): Promise<Map<string, { achieved: number; target: number; periodNumber: number }>> {
  const periods = await db.servicePeriod.findMany({ where: { clientId: { in: clientIds }, refYear: year, refMonth: month }, select: { id: true, clientId: true, number: true, target: true } });
  const out = new Map<string, { achieved: number; target: number; periodNumber: number }>();
  for (const p of periods) {
    const board = await periodBoard(p.clientId);
    const v = board.periods.find((x) => x.id === p.id);
    if (v) out.set(p.clientId, { achieved: v.achieved, target: v.target, periodNumber: v.number });
  }
  return out;
}

/** The client's current period = the latest one (what they are paying for now). */
export async function currentPeriodProgress(clientIds: string[]): Promise<Map<string, PeriodView>> {
  const out = new Map<string, PeriodView>();
  for (const id of clientIds) {
    const board = await periodBoard(id);
    const last = board.periods[board.periods.length - 1];
    if (last) out.set(id, last);
  }
  return out;
}
