/**
 * Year-end goal count (Esther, Nov 16 2026): "metas que se deben de acá al 15 de diciembre — todo el conteo
 * anterior lo puedes descartar". Each client carries the number she counted (`closingOwed`); what is still
 * pending is that number minus the goals secured since her count. Agenda periods are not touched.
 */
import { db } from "@/lib/db";
import { periodBoard } from "@/lib/service-periods";
import { STRATEGIST_ROLES } from "@/lib/strategist-report";
import { dayKeyInTz } from "@/components/runners/miami-time";

export const GOAL_CLOSING = {
  label: "Cierre 2026",
  /** The moment of Esther's count: goals secured after it reduce what is owed. */
  since: new Date("2026-11-16T17:20:00Z"),
  /** Last day of the year's work (Miami). */
  dueKey: "2026-12-15",
  dueLabel: "15 de diciembre",
  dueShort: "15 dic",
  sinceShort: "16 nov",
  /** Esther, Nov 16 2026: Verónica closes 12 and Esther 8; everything else is split among the other strategists. */
  fixedQuotas: { "veronicaf@ebmanagement.io": 12, "esther@ebmanagement.io": 8 } as Record<string, number>,
} as const;

export type ClosingRow = {
  id: string;
  name: string;
  owed: number;
  closed: number;
  pending: number;
  note: string | null;
  /** Owed, but the client is on hold: listed apart and left out of the totals. */
  hold: boolean;
  strategists: { name: string; goals: number }[];
};
export type ClosingBoard = {
  rows: ClosingRow[];
  /** Clients on hold with goals still owed (not in `rows` nor in the totals). */
  onHold: ClosingRow[];
  /** Active clients Esther's count has no number for. */
  uncounted: { id: string; name: string }[];
  owed: number;
  closed: number;
  pending: number;
  daysLeft: number;
  byStrategist: { id: string | null; name: string; goals: number }[];
};

export async function closingBoard(clients: { id: string; name: string; closingOwed: number | null; closingNote: string | null; closingHold: boolean }[], now = new Date()): Promise<ClosingBoard> {
  const since = GOAL_CLOSING.since;
  const sinceKey = dayKeyInTz(since);
  const counted = clients.filter((c) => c.closingOwed !== null);
  const secured = await Promise.all(counted.map(async (c) => {
    const board = await periodBoard(c.id);
    const units = [...board.periods.flatMap((p) => p.units), ...board.pending];
    return units.filter((u) => {
      if (u.state === "cancelled") return false;
      // A row imported from an old agenda (no closing date, event already past) is history, not a new goal.
      if (!u.closedAt && u.eventDate && dayKeyInTz(u.eventDate) < sinceKey) return false;
      return (u.closedAt ?? u.createdAt) >= since;
    });
  }));
  const goalIds = secured.flat().map((u) => u.goalId).filter((x): x is string => !!x);
  const isStrategist = (u: { role: string } | null) => !!u && (STRATEGIST_ROLES as string[]).includes(u.role);
  const closers = new Map((goalIds.length ? await db.deliverable.findMany({ where: { id: { in: goalIds } }, select: { id: true, closedBy: { select: { id: true, name: true, role: true } }, assignee: { select: { id: true, name: true, role: true } } } }) : []).map((g) => [g.id, isStrategist(g.closedBy) ? g.closedBy! : isStrategist(g.assignee) ? g.assignee! : null]));
  const team = new Map<string, { id: string | null; name: string; goals: number }>();
  const all: ClosingRow[] = counted.map((c, i) => {
    const m = new Map<string, number>();
    let closed = 0;
    for (const u of secured[i]) {
      const closer = (u.goalId ? closers.get(u.goalId) : null) ?? null;
      const who = closer?.name ?? "Sin estratega";
      m.set(who, (m.get(who) ?? 0) + u.weight);
      const t = team.get(closer?.id ?? "") ?? { id: closer?.id ?? null, name: who, goals: 0 };
      t.goals += u.weight;
      team.set(closer?.id ?? "", t);
      closed += u.weight;
    }
    const owed = c.closingOwed ?? 0;
    return { id: c.id, name: c.name, owed, closed, pending: Math.max(0, owed - closed), note: c.closingNote, hold: c.closingHold, strategists: [...m.entries()].map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals) };
  });
  const rows = all.filter((r) => !r.hold);
  rows.sort((a, b) => b.pending - a.pending || b.owed - a.owed || a.name.localeCompare(b.name, "es"));
  const todayKey = dayKeyInTz(now);
  const daysLeft = Math.max(0, Math.round((new Date(`${GOAL_CLOSING.dueKey}T00:00:00Z`).getTime() - new Date(`${todayKey}T00:00:00Z`).getTime()) / 86_400_000));
  return {
    rows,
    onHold: all.filter((r) => r.hold),
    uncounted: clients.filter((c) => c.closingOwed === null).map((c) => ({ id: c.id, name: c.name })),
    owed: rows.reduce((n, r) => n + r.owed, 0),
    // Only what counts against a client's own number (a client that over-delivers does not cover another's).
    closed: rows.reduce((n, r) => n + Math.min(r.closed, r.owed), 0),
    pending: rows.reduce((n, r) => n + r.pending, 0),
    daysLeft,
    byStrategist: [...team.values()].sort((a, b) => b.goals - a.goals),
  };
}

/**
 * What each strategist has to close per week so everything is done by the closing date. Verónica and Esther carry
 * their own fixed numbers (GOAL_CLOSING.fixedQuotas — private, never shown); the rest is split among the others.
 */
export async function weeklyPerStrategist(board: ClosingBoard): Promise<{ perWeek: number; strategists: number }> {
  const people = await db.user.findMany({ where: { isActive: true, role: { in: STRATEGIST_ROLES } }, select: { id: true, email: true } });
  const fixedOf = (email: string) => GOAL_CLOSING.fixedQuotas[email.toLowerCase()];
  const closedBy = (id: string) => board.byStrategist.find((s) => s.id === id)?.goals ?? 0;
  const fixedRemaining = people.reduce((n, p) => { const q = fixedOf(p.email); return q === undefined ? n : n + Math.max(0, q - closedBy(p.id)); }, 0);
  const others = people.filter((p) => fixedOf(p.email) === undefined).length;
  const weeks = Math.max(1, board.daysLeft / 7);
  const rest = Math.max(0, board.pending - fixedRemaining);
  return { perWeek: others ? Math.ceil(rest / others / weeks) : 0, strategists: others };
}
