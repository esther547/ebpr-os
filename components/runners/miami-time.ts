// Agency-timezone date helpers (Miami). Servers on Vercel run in UTC, so any
// "what day is it / which week is this" logic must be done explicitly in
// America/New_York instead of relying on the process timezone.
//
// A "day key" is a plain "yyyy-MM-dd" string. Server components compute keys
// here and pass them to client components, so server and browser render the
// same calendar day (no hydration mismatch, no off-by-one around midnight UTC).

import { addDays, format, parseISO, startOfWeek } from "date-fns";

export const AGENCY_TZ = "America/New_York";

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENCY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: AGENCY_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** "yyyy-MM-dd" for the given instant, as seen in Miami. */
export function dayKeyInTz(d: Date | string): string {
  return keyFormatter.format(new Date(d));
}

/** Minutes east of UTC that Miami is at the given instant (-240 or -300). */
function tzOffsetMinutes(d: Date): number {
  const parts = partsFormatter.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** The instant at which the given day key starts (00:00) in Miami. */
export function tzMidnight(dayKey: string): Date {
  const guess = new Date(`${dayKey}T00:00:00Z`);
  let result = new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000);
  // Re-check in case the offset differs at the resulting instant (DST edges).
  const offset = tzOffsetMinutes(result);
  if (result.getTime() !== guess.getTime() - offset * 60000) {
    result = new Date(guess.getTime() - offset * 60000);
  }
  return result;
}

/** Add days to a day key (pure calendar arithmetic, no timezone involved). */
export function addDaysKey(dayKey: string, days: number): string {
  return format(addDays(parseISO(dayKey), days), "yyyy-MM-dd");
}

/** Monday of the week containing the given day key. */
export function weekStartKey(dayKey: string): string {
  return format(startOfWeek(parseISO(dayKey), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Format a day key with a date-fns pattern (works identically on server and browser). */
export function formatDayKey(dayKey: string, pattern: string): string {
  return format(parseISO(dayKey), pattern);
}

/** Format an instant in Miami time (e.g. "h:mm a" style labels for server-rendered pages). */
export function formatInTz(
  d: Date | string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: AGENCY_TZ, ...options }).format(
    new Date(d)
  );
}

/** Inclusive-start / exclusive-end instants covering one Miami calendar day. */
export function dayBounds(dayKey: string): { gte: Date; lt: Date } {
  return { gte: tzMidnight(dayKey), lt: tzMidnight(addDaysKey(dayKey, 1)) };
}

/** Inclusive-start / exclusive-end instants covering a Miami calendar month. */
export function monthBounds(year: number, month: number): { gte: Date; lt: Date } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { gte: tzMidnight(start), lt: tzMidnight(nextMonth) };
}

/** Current month/year as seen in Miami. */
export function currentMonthYearInTz(now = new Date()): { month: number; year: number } {
  const key = dayKeyInTz(now);
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}
