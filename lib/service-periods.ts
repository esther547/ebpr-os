/**
 * SERVICE PERIODS — the client's accounting unit (Esther, Oct 1 2026).
 *
 * A client's agenda is organised by consecutive service periods ("Mes 1", "Mes 2"…), each with the
 * goals agreed for it. Periods are assigned by hand and do not have to be consecutive calendar
 * months (Grace: Mes 1 = mayo, Mes 2 = septiembre). A unit (a pauta, with or without a goal, or a
 * closed goal without a pauta) belongs to exactly one period, or to none while the admin reviews it.
 *
 * Rules: moving an event's date never changes its period; executing a closed goal updates its
 * status without moving it or counting it twice; one activity may cover a whole period when the
 * client agreed to it (coversPeriod + note). New units default to the latest period with room;
 * when there is none they wait for the admin ("Pendientes de asignar").
 */
import { db } from "@/lib/db";
import { CLOSED_GOAL_STATUSES, isClosedGoal } from "@/lib/goal-status";
import { MONTH_NAMES_ES } from "@/lib/agenda-months";

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
  /** How many goals this unit is worth (1, or the period's target when it covers the period). */
  weight: number;
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
      where: { clientId, status: { not: "CANCELLED" } },
      select: { id: true, deliverableId: true, eventName: true, eventDate: true, status: true, periodId: true, coversPeriod: true, periodNote: true, createdAt: true },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    }),
    db.deliverable.findMany({
      where: { clientId, status: { in: [...CLOSED_GOAL_STATUSES] }, isInternal: false },
      select: { id: true, title: true, status: true, dueDate: true, closedAt: true, completedAt: true, periodId: true, coversPeriod: true, periodNote: true, createdAt: true },
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
      weight: 1,
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
      weight: 1,
    });
  }
  return units;
}

export type PeriodView = PeriodDTO & { units: PeriodUnit[]; achieved: number; closedPending: number; executed: number };

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
    const list = (byPeriod.get(p.id) ?? []).map((u) => ({ ...u, weight: u.coversPeriod ? p.target : 1 }));
    const achieved = Math.min(p.target || Infinity, list.reduce((s, u) => s + u.weight, 0));
    return {
      ...p,
      units: list,
      achieved: p.target ? achieved : list.length,
      closedPending: list.filter((u) => u.state === "closed_pending").length,
      executed: list.filter((u) => u.state === "executed").length,
    };
  });
  return { periods: views, pending };
}

/** The latest period that still has room, for a brand-new unit. Null → the unit waits for review. */
export async function defaultPeriodFor(clientId: string): Promise<string | null> {
  const { periods } = await periodBoard(clientId);
  if (!periods.length) return null;
  const last = periods[periods.length - 1];
  return last.achieved < last.target || last.target === 0 ? last.id : null;
}

/** Place a unit (by pauta or goal) in a period — or in none. Keeps pauta + goal in sync and the derived month fields. */
export async function assignPeriod(
  ref: { pautaId?: string | null; goalId?: string | null },
  periodId: string | null,
  extra: { coversPeriod?: boolean; periodNote?: string | null } = {}
): Promise<void> {
  const period = periodId ? await db.servicePeriod.findUnique({ where: { id: periodId }, select: { id: true, refYear: true, refMonth: true } }) : null;
  const data = { periodId: period?.id ?? null, ...(extra.coversPeriod !== undefined ? { coversPeriod: extra.coversPeriod } : {}), ...(extra.periodNote !== undefined ? { periodNote: extra.periodNote } : {}) };
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

/** New unit: put it in the latest period with room (never moves anything already placed). */
export async function placeNewUnit(clientId: string | null | undefined, ref: { pautaId?: string | null; goalId?: string | null }): Promise<void> {
  if (!clientId) return;
  try {
    const periodId = await defaultPeriodFor(clientId);
    await assignPeriod(ref, periodId);
  } catch (err) {
    console.error("placeNewUnit failed:", err);
  }
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
