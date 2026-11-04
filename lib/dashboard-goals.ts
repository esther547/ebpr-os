/**
 * Dashboard goal outlook (Esther, Nov 3 2026): one honest count instead of "132 por cerrar".
 * Every service period of every active client is placed in time with the client's cycle:
 *   overdue  = cycle already ended and goals still missing (computed, never a manual number)
 *   inCourse = cycle started and not ended (this is "what we are closing now")
 *   dueWeek  = subset of inCourse ending within 7 days
 *   future   = not started yet (not counted anywhere)
 * Plus the team's weekly pace: goals closed per strategist this week against WEEKLY_GOAL_TARGET.
 */
import { db } from "@/lib/db";
import { cycleForLabel, type Cycle } from "@/lib/cycles";
import { periodBoard, type PeriodView } from "@/lib/service-periods";
import { STRATEGIST_ROLES, loadActiveStrategists } from "@/lib/strategist-report";
import { dayKeyInTz } from "@/components/runners/miami-time";

/** Esther: a strategist normally closes 6–8 goals a week; 7 is the reference. */
export const WEEKLY_GOAL_TARGET = 7;

export type PeriodSlot = { clientId: string; clientName: string; period: PeriodView; cycle: Cycle; daysLeft: number; state: "overdue" | "inCourse" | "future" };
export type GoalOutlook = {
  todayKey: string;
  overdue: PeriodSlot[];
  inCourse: PeriodSlot[];
  dueWeek: PeriodSlot[];
  future: PeriodSlot[];
  /** The period each client is working on right now: in-course first, else the most recent overdue, else the next future one. */
  relevant: Map<string, PeriodSlot>;
  sum: (slots: PeriodSlot[]) => number;
};

const dayDiff = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

export async function goalOutlook(clients: { id: string; name: string; cycleDay: number | null }[], now = new Date()): Promise<GoalOutlook> {
  const todayKey = dayKeyInTz(now);
  const overdue: PeriodSlot[] = [], inCourse: PeriodSlot[] = [], future: PeriodSlot[] = [];
  const relevant = new Map<string, PeriodSlot>();
  for (const c of clients) {
    const board = await periodBoard(c.id);
    const slots: PeriodSlot[] = board.periods.map((p) => {
      const cycle = cycleForLabel(c.cycleDay, p.refYear, p.refMonth);
      const daysLeft = dayDiff(todayKey, cycle.endKey);
      const state: PeriodSlot["state"] = cycle.endKey <= todayKey ? "overdue" : cycle.startKey > todayKey ? "future" : "inCourse";
      return { clientId: c.id, clientName: c.name, period: p, cycle, daysLeft, state };
    });
    for (const s of slots) {
      if (s.state === "overdue") { if (s.period.missing > 0 && s.period.target > 0) overdue.push(s); }
      else if (s.state === "inCourse") inCourse.push(s);
      else future.push(s);
    }
    const cur = slots.filter((s) => s.state === "inCourse").sort((a, b) => a.cycle.endKey.localeCompare(b.cycle.endKey))[0]
      ?? slots.filter((s) => s.state === "overdue" && s.period.missing > 0).sort((a, b) => b.cycle.endKey.localeCompare(a.cycle.endKey))[0]
      ?? slots.filter((s) => s.state === "future").sort((a, b) => a.cycle.startKey.localeCompare(b.cycle.startKey))[0]
      ?? slots[slots.length - 1];
    if (cur) relevant.set(c.id, cur);
  }
  const dueWeek = inCourse.filter((s) => s.period.missing > 0 && s.daysLeft <= 7);
  const sum = (slots: PeriodSlot[]) => slots.reduce((n, s) => n + Math.max(0, s.period.missing), 0);
  overdue.sort((a, b) => a.cycle.endKey.localeCompare(b.cycle.endKey));
  inCourse.sort((a, b) => a.cycle.endKey.localeCompare(b.cycle.endKey));
  return { todayKey, overdue, inCourse, dueWeek, future, relevant, sum };
}

export type PaceRow = { id: string; name: string; thisWeek: number; lastWeek: number };
export type TeamPace = { weekStart: string; weekEnd: string; rows: PaceRow[]; unassigned: number; target: number; teamThisWeek: number; capacity: number };

/** Monday-to-Sunday (Miami) closes per strategist, this week and last. */
export async function teamPace(now = new Date()): Promise<TeamPace> {
  const todayKey = dayKeyInTz(now);
  const d = new Date(`${todayKey}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow);
  const weekStart = d.toISOString().slice(0, 10);
  const lastStart = new Date(d.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const weekEnd = new Date(d.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const [strategists, goals] = await Promise.all([
    loadActiveStrategists(),
    db.deliverable.findMany({ where: { closedAt: { gte: new Date(`${lastStart}T04:00:00Z`) }, status: { not: "CANCELLED" }, isInternal: false }, select: { closedAt: true, goalValue: true, closedBy: { select: { id: true, role: true } }, assignee: { select: { id: true, role: true } } } }),
  ]);
  const rows = new Map<string, PaceRow>(strategists.map((s) => [s.id, { id: s.id, name: s.name, thisWeek: 0, lastWeek: 0 }]));
  let unassigned = 0;
  const isStrat = (u: { id: string; role: string } | null) => !!u && (STRATEGIST_ROLES as string[]).includes(u.role);
  for (const g of goals) {
    const key = dayKeyInTz(g.closedAt!);
    const bucket: "thisWeek" | "lastWeek" | null = key >= weekStart ? "thisWeek" : key >= lastStart ? "lastWeek" : null;
    if (!bucket) continue;
    const who = isStrat(g.closedBy) ? g.closedBy!.id : isStrat(g.assignee) ? g.assignee!.id : null;
    const w = g.goalValue ?? 1;
    if (who && rows.has(who)) rows.get(who)![bucket] += w; else if (bucket === "thisWeek") unassigned += w;
  }
  const list = [...rows.values()].sort((a, b) => b.thisWeek - a.thisWeek || a.name.localeCompare(b.name));
  return { weekStart, weekEnd, rows: list, unassigned, target: WEEKLY_GOAL_TARGET, teamThisWeek: list.reduce((n, r) => n + r.thisWeek, 0), capacity: list.length * WEEKLY_GOAL_TARGET };
}
