/**
 * Per-client goal cycles ("fecha de corte").
 *
 * Goals are not counted by calendar month for every client: each client has a cycle that
 * resets on `cycleDay` (1-31). A cycle that starts on day d of month M runs until day d-1
 * of the next month. Deliverables are tagged with a (month, year) label; for a client with a
 * cycle we label the cycle by the month that holds most of its days:
 *   d <= 15  -> label = M        (Sep 15 .. Oct 14 = "September")
 *   d  > 15  -> label = M + 1    (Aug 25 .. Sep 24 = "September")
 * Clients without a cycleDay use plain calendar months (label = M).
 *
 * All math is done on calendar days in Miami (America/New_York) using "yyyy-MM-dd" keys.
 */
import { dayKeyInTz, tzMidnight } from "@/components/runners/miami-time";

export type Cycle = {
  /** First day of the cycle, "yyyy-MM-dd" (Miami). */
  startKey: string;
  /** Day after the last day of the cycle, "yyyy-MM-dd" (exclusive). */
  endKey: string;
  /** Label month/year, used as Deliverable.month/year. */
  month: number;
  year: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** "yyyy-MM-dd" for a (year, month, day), clamping the day to the month's length. */
function key(year: number, month1to12: number, day: number) {
  const d = Math.min(day, daysInMonth(year, month1to12));
  return `${year}-${pad(month1to12)}-${pad(d)}`;
}

function addMonths(year: number, month1to12: number, delta: number) {
  const idx = year * 12 + (month1to12 - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/**
 * The cycle that contains the given Miami day key for a client with `cycleDay`.
 * With no cycleDay (or day 1), this is the calendar month.
 */
export function cycleForDayKey(cycleDay: number | null | undefined, dayKey: string): Cycle {
  const [y, m, d] = dayKey.split("-").map(Number);
  const cd = cycleDay && cycleDay >= 1 && cycleDay <= 31 ? cycleDay : 1;

  // Start month: the most recent day `cd` on or before the given day.
  let start = d >= Math.min(cd, daysInMonth(y, m)) ? { year: y, month: m } : addMonths(y, m, -1);
  const next = addMonths(start.year, start.month, 1);
  const label = cd <= 15 ? start : next;

  return {
    startKey: key(start.year, start.month, cd),
    endKey: key(next.year, next.month, cd),
    month: label.month,
    year: label.year,
  };
}

/** The client's current cycle (Miami "today"). */
export function currentCycle(cycleDay: number | null | undefined, now: Date = new Date()): Cycle {
  return cycleForDayKey(cycleDay, dayKeyInTz(now));
}

/** The cycle a due date falls in, for tagging a deliverable's month/year. */
export function cycleForDate(cycleDay: number | null | undefined, date: Date): Cycle {
  return cycleForDayKey(cycleDay, dayKeyInTz(date));
}

/** Shift a cycle by n cycles (n = -1 previous, +1 next). */
export function shiftCycle(cycleDay: number | null | undefined, cycle: Cycle, n: number): Cycle {
  const [y, m] = cycle.startKey.split("-").map(Number);
  const s = addMonths(y, m, n);
  const cd = cycleDay && cycleDay >= 1 ? cycleDay : 1;
  return cycleForDayKey(cycleDay, key(s.year, s.month, cd));
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** "September 2026" plus the day range when the cycle is not a calendar month. */
export function cycleLabel(cycle: Cycle, cycleDay?: number | null): string {
  const base = `${MONTHS[cycle.month - 1]} ${cycle.year}`;
  if (!cycleDay || cycleDay === 1) return base;
  const fmt = (k: string) => {
    const [, m, d] = k.split("-").map(Number);
    return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
  };
  const lastDay = tzMidnight(cycle.endKey);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return `${base} · ${fmt(cycle.startKey)} – ${fmt(dayKeyInTz(lastDay))}`;
}
