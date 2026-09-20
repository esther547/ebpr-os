// Shared date + API-error helpers (no React, safe for server and client).
//
// Date-only fields (sentAt, signedAt, startDate, endDate) are stored as UTC midnight
// (new Date("YYYY-MM-DD")). Display and compare them in UTC so they never shift a day.

type DateLike = string | Date | null | undefined;

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a date string from the UI/API. "YYYY-MM-DD" becomes UTC midnight; ISO timestamps are kept. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** UTC midnight of the calendar day that `now` falls on (UTC). */
export function startOfTodayUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Browser-local calendar date as "YYYY-MM-DD" (what a user means by "today"). */
export function localDateInputValue(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" (UTC) for <input type="date">. */
export function toDateInputValue(d: DateLike): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** "Sep 10, 2026" rendered in UTC so date-only values never shift by a day. */
export function formatDateOnly(d: DateLike): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Whole days between a past date and now (never negative). */
export function daysSince(d: DateLike, now: Date = new Date()): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** Turn an API error payload (string, zod fieldErrors, or flatten()) into one message. */
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const fieldErrors = (err as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? (err as Record<string, unknown>);
    const parts: string[] = [];
    for (const [key, val] of Object.entries(fieldErrors)) {
      if (Array.isArray(val) && val.length) parts.push(`${key}: ${val.join(", ")}`);
    }
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}
