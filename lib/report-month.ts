/**
 * Report month of a goal (Esther, Sept 28 2026).
 *
 * A goal counts toward the client's REPORT month, not the month the pauta airs. Each report
 * month holds `monthlyTarget` goals, filled in closing order (see closingReportMonth).
 * Strategists can always move a goal to another report month by hand ("Mes del reporte").
 */
import { db } from "@/lib/db";
import { currentCycle, cycleForDate } from "@/lib/cycles";
import { CLOSED_GOAL_STATUSES } from "@/lib/goal-status";

const COUNTS_TOWARD_QUOTA = { notIn: ["CANCELLED", "IDEA"] as const };
/** Goal accounting in the portal starts here (the restart); older months are history and never filled. */
export const REPORT_MONTH_FLOOR = { year: 2026, month: 9 };
const idx = (y: number, m: number) => y * 12 + m;

function addMonths(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/**
 * THE rule (Esther, Sept 28 2026, evening): every report month must show its `monthlyTarget`
 * goals, whatever the pauta's date. A goal that closes fills the EARLIEST month (from the
 * floor) that still has room, up to the month it closes in. When every month up to the
 * closing month is full, it goes to the next month with room (the client is ahead —
 * "con Marko vamos por julio"). Strategists can still move a goal by hand ("Mes del reporte").
 */
export async function closingReportMonth(clientId: string, closedAt: Date = new Date(), opts: { excludeId?: string } = {}): Promise<{ month: number; year: number }> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { cycleDay: true, monthlyTarget: true } });
  const closing = cycleForDate(client?.cycleDay, closedAt);
  const target = client?.monthlyTarget ?? 0;
  if (target <= 0) return { month: closing.month, year: closing.year };

  const rows = await db.deliverable.groupBy({
    by: ["year", "month"],
    where: { clientId, status: { in: [...CLOSED_GOAL_STATUSES] }, ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}) },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [`${r.year}-${r.month}`, r._count._all]));
  let m = idx(closing.year, closing.month) < idx(REPORT_MONTH_FLOOR.year, REPORT_MONTH_FLOOR.month) ? { ...closing } : { ...REPORT_MONTH_FLOOR };
  for (let i = 0; i < 36; i++) {
    if ((counts.get(`${m.year}-${m.month}`) ?? 0) < target) return m;
    m = addMonths(m.year, m.month, 1);
  }
  return { month: closing.month, year: closing.year };
}

/** Earlier "fill the first month with room" rule; kept for reference, no longer the default. */
export async function defaultReportMonth(
  clientId: string,
  now: Date = new Date()
): Promise<{ month: number; year: number }> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { monthlyTarget: true, cycleDay: true } });
  const current = currentCycle(client?.cycleDay, now);
  const target = client?.monthlyTarget ?? 0;
  if (target <= 0) return { month: current.month, year: current.year };

  const rows = await db.deliverable.groupBy({
    by: ["year", "month"],
    where: { clientId, status: { notIn: [...COUNTS_TOWARD_QUOTA.notIn] } },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [`${r.year}-${r.month}`, r._count._all]));
  const eligible = rows.filter((r) => idx(r.year, r.month) >= idx(REPORT_MONTH_FLOOR.year, REPORT_MONTH_FLOOR.month));
  const first = eligible.length
    ? eligible.reduce((a, b) => (idx(a.year, a.month) <= idx(b.year, b.month) ? a : b))
    : { year: current.year, month: current.month };

  // Earliest month with room, from the first month with goals (not before the floor) through the current cycle…
  let m = idx(first.year, first.month) <= idx(current.year, current.month) ? { year: first.year, month: first.month } : { year: current.year, month: current.month };
  if (idx(m.year, m.month) < idx(REPORT_MONTH_FLOOR.year, REPORT_MONTH_FLOOR.month)) m = { ...REPORT_MONTH_FLOOR };
  for (let i = 0; i < 36; i++) {
    const key = `${m.year}-${m.month}`;
    if ((counts.get(key) ?? 0) < target) return m;
    const isCurrentOrLater = m.year * 12 + m.month >= current.year * 12 + current.month;
    m = addMonths(m.year, m.month, 1);
    if (isCurrentOrLater && i > 24) break;
  }
  return { month: current.month, year: current.year };
}

/** Months a strategist can pick for a goal: from 6 months back to 6 months ahead of the current cycle. */
export function reportMonthOptions(cycleDay: number | null | undefined, now: Date = new Date()): { month: number; year: number; label: string }[] {
  const current = currentCycle(cycleDay, now);
  const names = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const out = [];
  for (let d = -6; d <= 6; d++) {
    const m = addMonths(current.year, current.month, d);
    out.push({ ...m, label: `${names[m.month - 1]} ${m.year}${d === 0 ? " (ciclo actual)" : ""}` });
  }
  return out;
}
