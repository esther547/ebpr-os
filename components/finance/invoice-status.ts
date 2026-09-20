// Shared invoice status + date helpers (no React, safe for server and client).
//
// Date-only fields (dueDate, sentAt, paidAt, issuedAt, startDate, endDate) are stored
// as UTC midnight (new Date("YYYY-MM-DD")). They must be displayed and compared in UTC,
// otherwise every date shifts back one day in US timezones.

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

export type InvoiceLike = {
  status: string;
  dueDate?: DateLike;
  paidAt?: DateLike;
};

export function isInvoicePaid(inv: InvoiceLike): boolean {
  return inv.status === "PAID" || !!inv.paidAt;
}

/**
 * An invoice is overdue when it is not PAID/CANCELLED and its due date is at least
 * one full day in the past (or it was explicitly marked OVERDUE).
 */
export function isInvoiceOverdue(inv: InvoiceLike, now: Date = new Date()): boolean {
  if (inv.status === "PAID" || inv.status === "CANCELLED" || inv.paidAt) return false;
  if (inv.status === "OVERDUE") return true;
  if (!inv.dueDate) return false;
  const due = new Date(inv.dueDate);
  if (isNaN(due.getTime())) return false;
  return due.getTime() < startOfTodayUTC(now).getTime();
}

/** Whole days between a past date and now (never negative). */
export function daysSince(d: DateLike, now: Date = new Date()): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** Prisma `where` fragment for invoices that need payment follow-up. */
export function overdueInvoiceWhere(now: Date = new Date()) {
  return {
    paidAt: null,
    OR: [
      { status: "OVERDUE" as const },
      { status: { in: ["DRAFT" as const, "SENT" as const] }, dueDate: { lt: startOfTodayUTC(now) } },
    ],
  };
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
