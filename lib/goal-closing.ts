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
  /** The moment of Esther's count (recounted Nov 23 2026, client by client): goals secured after it reduce what is owed. */
  since: new Date("2026-11-23T16:50:00Z"),
  /** Her first count (Nov 16): what a strategist left unclosed that week against the weekly share of then stays theirs. */
  firstCount: { weekKey: "2026-11-16", weeklyShare: 9 },
  /** Last day of the year's work (Miami). */
  dueKey: "2026-12-15",
  dueLabel: "15 de diciembre",
  dueShort: "15 dic",
  sinceShort: "23 nov",
  /** Esther, Nov 16 2026: Verónica closes 12 and Esther 8; everything else is split among the other strategists. */
  fixedQuotas: { "veronicaf@ebmanagement.io": 12, "esther@ebmanagement.io": 8 } as Record<string, number>,
  /**
   * Esther, Nov 23 2026: "separar noviembre y diciembre — cobrar diciembre antes de adelantar metas de diciembre".
   * Once a client carries a December number (closingOwedDec), the count splits: November is due on novDueKey and
   * December is due on dueKey. New goals pay November first; only the surplus counts for December. A client's
   * December goals wait while it has a billing day (closingBillKey); the rest can be worked already.
   */
  novDueKey: "2026-11-30",
  novDueLabel: "30 de noviembre",
  novDueShort: "30 nov",
} as const;

export type ClosingRow = {
  id: string;
  name: string;
  owed: number;
  closed: number;
  pending: number;
  /** November part (the whole count while it is not split) and December part. */
  owedNov: number;
  pendingNov: number;
  owedDec: number;
  pendingDec: number;
  /** New goals beyond November's number: they already count for December. */
  advancedDec: number;
  /** Day Esther bills December (yyyy-MM-dd); while set, the December goals wait. Admin-only information. */
  billKey: string | null;
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
  /** True once any client has a December number: November and December are counted apart. */
  split: boolean;
  /** Which part the team is working on today. */
  phase: "nov" | "dec";
  nov: { owed: number; closed: number; pending: number; daysLeft: number };
  /** December goals that can be worked already (billed, or nothing to wait for). */
  decOpen: { owed: number; closed: number; pending: number };
  /** December goals of clients not billed yet: not to be advanced. */
  decWaiting: { owed: number; closed: number; pending: number };
  byStrategist: { id: string | null; name: string; goals: number }[];
};

const mondayOf = (dayKey: string) => { const d = new Date(`${dayKey}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

export async function closingBoard(clients: { id: string; name: string; closingOwed: number | null; closingOwedDec?: number | null; closingBillKey?: string | null; closingNote: string | null; closingHold: boolean }[], now = new Date()): Promise<ClosingBoard> {
  const since = GOAL_CLOSING.since;
  const sinceKey = dayKeyInTz(since);
  const inCount = (c: { closingOwed: number | null; closingOwedDec?: number | null }) => c.closingOwed !== null || (c.closingOwedDec ?? null) !== null;
  const counted = clients.filter(inCount);
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
    const owedNov = c.closingOwed ?? 0;
    const owedDec = c.closingOwedDec ?? 0;
    const owed = owedNov + owedDec;
    // New goals pay November first; only what is left over counts for December.
    const advancedDec = Math.min(owedDec, Math.max(0, closed - owedNov));
    return { id: c.id, name: c.name, owed, closed, pending: Math.max(0, owed - closed), owedNov, pendingNov: Math.max(0, owedNov - closed), owedDec, pendingDec: owedDec - advancedDec, advancedDec, billKey: c.closingBillKey ?? null, note: c.closingNote, hold: c.closingHold, strategists: [...m.entries()].map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals) };
  });
  const rows = all.filter((r) => !r.hold);
  rows.sort((a, b) => b.pending - a.pending || b.owed - a.owed || a.name.localeCompare(b.name, "es"));
  const todayKey = dayKeyInTz(now);
  const daysTo = (key: string) => Math.max(0, daysBetween(todayKey, key));
  const daysLeft = daysTo(GOAL_CLOSING.dueKey);
  const sum = (f: (r: ClosingRow) => number, of: ClosingRow[] = rows) => of.reduce((n, r) => n + f(r), 0);
  const open = rows.filter((r) => !r.billKey);
  const waiting = rows.filter((r) => !!r.billKey);
  const decOf = (of: ClosingRow[]) => ({ owed: sum((r) => r.owedDec, of), closed: sum((r) => r.advancedDec, of), pending: sum((r) => r.pendingDec, of) });
  return {
    rows,
    onHold: all.filter((r) => r.hold),
    uncounted: clients.filter((c) => !inCount(c)).map((c) => ({ id: c.id, name: c.name })),
    split: clients.some((c) => (c.closingOwedDec ?? null) !== null),
    phase: todayKey <= GOAL_CLOSING.novDueKey ? "nov" : "dec",
    nov: { owed: sum((r) => r.owedNov), closed: sum((r) => Math.min(r.closed, r.owedNov)), pending: sum((r) => r.pendingNov), daysLeft: daysTo(GOAL_CLOSING.novDueKey) },
    decOpen: decOf(open),
    decWaiting: decOf(waiting),
    owed: rows.reduce((n, r) => n + r.owed, 0),
    // Only what counts against a client's own number (a client that over-delivers does not cover another's).
    closed: rows.reduce((n, r) => n + Math.min(r.closed, r.owed), 0),
    pending: rows.reduce((n, r) => n + r.pending, 0),
    daysLeft,
    byStrategist: [...team.values()].sort((a, b) => b.goals - a.goals),
  };
}

/** Strategists whose weekly number never carries over (Esther, Nov 20 2026: "con todos los estrategas menos conmigo"). */
const NO_CARRY_OVER = ["esther@ebmanagement.io"];

export type StrategistDue = {
  /** Their share of one week. */
  base: number;
  /** What they left unclosed in earlier weeks of the count: it stays theirs. */
  carried: number;
  /** What they owe this week: base + carried. */
  due: number;
  closed: number;
  missing: number;
  /** What next week becomes if this one ends as it stands. */
  next: number;
  /** A fixed personal number (GOAL_CLOSING.fixedQuotas): only that person and Esther may see it. */
  isPrivate: boolean;
};


/**
 * What each strategist owes per week until the closing date, person by person (Esther, Nov 20 2026): the weekly
 * share is fixed from her count, and whatever someone does not close in a week is added to THEIR next week
 * ("Ayax está en 3 esta semana → la semana que viene le tocan las que no cumplió"). Verónica and Esther carry
 * their own fixed totals (GOAL_CLOSING.fixedQuotas — private); Esther has no carry-over at all.
 * Weeks are Monday–Sunday in Miami and goals count by closing day, exactly like the weekly pace card.
 * When the count is split, November's share is spread over the weeks up to Nov 30 and December's over the weeks
 * from Dec 1; what is left of November keeps being carried into December, person by person.
 */
export async function weeklyDue(board: ClosingBoard, now = new Date()): Promise<{ base: number; strategists: number; rows: Map<string, StrategistDue>; isLastWeek: boolean }> {
  const people = await db.user.findMany({ where: { isActive: true, role: { in: STRATEGIST_ROLES } }, select: { id: true, email: true } });
  const fixedOf = (email: string) => GOAL_CLOSING.fixedQuotas[email.toLowerCase()];
  const others = people.filter((p) => fixedOf(p.email) === undefined).length;
  const sinceKey = dayKeyInTz(GOAL_CLOSING.since);
  const startWeek = mondayOf(sinceKey);
  const thisWeek = mondayOf(dayKeyInTz(now));
  const weeksDone = Math.max(0, Math.round(daysBetween(startWeek, thisWeek) / 7));

  // The parts of the count: one (the whole window) or two — November, due Nov 30, and the December goals that can
  // already be worked, due on the closing date. December goals waiting to be billed are nobody's yet.
  const parts = board.split
    ? [
        { owed: board.nov.owed, from: 0, weeks: Math.max(1, daysBetween(sinceKey, GOAL_CLOSING.novDueKey) / 7) },
        { owed: board.decOpen.owed, from: 0, weeks: Math.max(1, daysBetween(sinceKey, GOAL_CLOSING.dueKey) / 7) },
      ]
    : [{ owed: board.owed, from: 0, weeks: Math.max(1, daysBetween(sinceKey, GOAL_CLOSING.dueKey) / 7) }];
  const allOwed = parts.reduce((n, p) => n + p.owed, 0);
  /** A fixed personal total, split between the parts in proportion to what each part owes. */
  const fixedIn = (quota: number, i: number) => {
    if (parts.length === 1 || allOwed === 0) return i === 0 ? quota : 0;
    const first = Math.min(quota, Math.round((quota * parts[0].owed) / allOwed));
    return i === 0 ? first : quota - first;
  };
  const quotas = people.map((p) => fixedOf(p.email)).filter((q): q is number => q !== undefined);
  const shareIn = (i: number) => (others ? Math.ceil(Math.max(0, parts[i].owed - quotas.reduce((n, q) => n + fixedIn(q, i), 0)) / others) : 0);
  /** What a person with these totals should have closed after `weeks` weeks of the count (never more than each part's total). */
  const schedule = (totals: number[]) => (weeks: number) => parts.reduce((n, p, i) => n + Math.min(totals[i], Math.ceil(totals[i] / p.weeks) * Math.max(0, weeks - p.from)), 0);
  /** This week's own share (without anything carried). */
  const weekShare = (totals: number[]) => schedule(totals)(weeksDone + 1) - schedule(totals)(weeksDone);
  // Before this count there was the first one: what someone left unclosed then is still theirs.
  const first = GOAL_CLOSING.firstCount;
  const firstWeeks = Math.max(0, Math.round(daysBetween(first.weekKey, startWeek) / 7));
  const firstShare = (quota: number | undefined) => (quota === undefined ? first.weeklyShare : Math.ceil(quota / (daysBetween(first.weekKey, GOAL_CLOSING.dueKey) / 7)));

  const goals = await db.deliverable.findMany({
    where: { closedAt: { gte: new Date(`${first.weekKey < startWeek ? first.weekKey : startWeek}T04:00:00Z`) }, status: { not: "CANCELLED" }, isInternal: false },
    select: { closedAt: true, goalValue: true, closedBy: { select: { id: true, role: true } }, assignee: { select: { id: true, role: true } } },
  });
  const isStrat = (u: { role: string } | null) => !!u && (STRATEGIST_ROLES as string[]).includes(u.role);
  const earlier = new Map<string, number>();
  const before = new Map<string, number>();
  const current = new Map<string, number>();
  for (const g of goals) {
    const key = dayKeyInTz(g.closedAt!);
    if (key < first.weekKey) continue;
    const who = isStrat(g.closedBy) ? g.closedBy!.id : isStrat(g.assignee) ? g.assignee!.id : null;
    if (!who) continue;
    const bucket = key < startWeek ? earlier : key < thisWeek ? before : current;
    bucket.set(who, (bucket.get(who) ?? 0) + (g.goalValue ?? 1));
  }

  const rows = new Map<string, StrategistDue>();
  for (const p of people) {
    if (NO_CARRY_OVER.includes(p.email.toLowerCase())) continue;
    const fixed = fixedOf(p.email);
    const totals = parts.map((_, i) => (fixed === undefined ? shareIn(i) : fixedIn(fixed, i)));
    const base = weekShare(totals);
    const expected = schedule(totals);
    const fromFirst = Math.max(0, firstShare(fixed) * firstWeeks - (earlier.get(p.id) ?? 0));
    const carried = Math.max(0, fromFirst + expected(weeksDone) - (before.get(p.id) ?? 0));
    const due = expected(weeksDone + 1) - expected(weeksDone) + carried;
    const closed = current.get(p.id) ?? 0;
    const missing = Math.max(0, due - closed);
    rows.set(p.id, { base, carried, due, closed, missing, next: expected(weeksDone + 2) - expected(weeksDone + 1) + missing, isPrivate: fixed !== undefined });
  }
  // After this week there is no other one before the closing date.
  const isLastWeek = daysBetween(thisWeek, GOAL_CLOSING.dueKey) < 7;
  return { base: weekShare(parts.map((_, i) => shareIn(i))), strategists: others, rows, isLastWeek };
}
