// Industry events calendar — pure helpers shared by the server (cron, API,
// page) and the browser. No Prisma / React imports here.
//
// Dates are handled as Miami "day keys" ("yyyy-MM-dd"). An occurrence is
// stored in the DB at 12:00 UTC of its calendar day so it never shifts a day
// in any timezone.

export const EVENT_CATEGORIES = [
  "AWARDS",
  "FASHION",
  "FILM",
  "GALA",
  "SPORTS",
  "MEDIA",
  "OTHER",
] as const;

export type EventCategoryValue = (typeof EVENT_CATEGORIES)[number];

/** Singular label (badge, select). */
export const CATEGORY_LABEL: Record<EventCategoryValue, string> = {
  AWARDS: "Premios",
  FASHION: "Moda",
  FILM: "Cine",
  GALA: "Gala",
  SPORTS: "Deportes",
  MEDIA: "Medios",
  OTHER: "Otro",
};

/** Plural label (filter chips). */
export const CATEGORY_CHIP_LABEL: Record<EventCategoryValue, string> = {
  AWARDS: "Premios",
  FASHION: "Moda",
  FILM: "Cine",
  GALA: "Galas",
  SPORTS: "Deportes",
  MEDIA: "Medios",
  OTHER: "Otros",
};

export const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const MONTHS_ES_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

export const DEFAULT_LEAD_DAYS = 60;

/** Days in a month (1-12) of a given year. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "yyyy-MM-dd" for a year/month/day; the day is clamped to the month's length (Feb 29 → Feb 28). */
export function occurrenceKey(year: number, month: number, day: number | null | undefined): string {
  const d = Math.min(Math.max(day ?? 1, 1), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The DB value for an occurrence day: 12:00 UTC of that calendar day. */
export function keyToNoonUtc(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00Z`);
}

/** Pure calendar arithmetic on a day key (no timezone involved). */
export function shiftKey(dayKey: string, days: number): string {
  const d = keyToNoonUtc(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `fromKey` to `toKey` (positive when `toKey` is later). */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToNoonUtc(toKey).getTime() - keyToNoonUtc(fromKey).getTime()) / 86_400_000);
}

/**
 * The next occurrence (day key) of an event on or after `todayKey`.
 * - Fixed year: that date, or null when it is already in the past.
 * - Recurring: this year's month/day (day ?? 1), or next year's when already past.
 */
export function nextOccurrenceKey(
  event: { month: number; day: number | null; year: number | null },
  todayKey: string
): string | null {
  if (event.year) {
    const key = occurrenceKey(event.year, event.month, event.day);
    return key >= todayKey ? key : null;
  }
  const thisYear = Number(todayKey.slice(0, 4));
  const key = occurrenceKey(thisYear, event.month, event.day);
  return key >= todayKey ? key : occurrenceKey(thisYear + 1, event.month, event.day);
}

/** "≈ 4 may" when the day is known, "mayo" when the event is "durante el mes". */
export function approxDateLabel(dayKey: string, hasDay: boolean): string {
  const month = Number(dayKey.slice(5, 7));
  if (!hasDay) return MONTHS_ES[month - 1];
  return `≈ ${Number(dayKey.slice(8, 10))} ${MONTHS_ES_SHORT[month - 1]}`;
}

/** "5 mar" — a plain short date. */
export function shortDateLabel(dayKey: string): string {
  return `${Number(dayKey.slice(8, 10))} ${MONTHS_ES_SHORT[Number(dayKey.slice(5, 7)) - 1]}`;
}

/** "octubre 2026" for a "yyyy-MM" or "yyyy-MM-dd" key. */
export function monthYearLabel(key: string): string {
  return `${MONTHS_ES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/** The weekly-priority title created for an event occurrence. */
export function opportunityPriorityTitle(name: string, occurrenceDayKey: string): string {
  return `Trabajar oportunidad: ${name} (${MONTHS_ES[Number(occurrenceDayKey.slice(5, 7)) - 1]})`;
}

/** Lowercase, accent-free text for client-side search. */
export function searchable(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Serializable row the /events page renders. */
export type UpcomingEventItem = {
  id: string;
  name: string;
  category: EventCategoryValue;
  month: number;
  day: number | null;
  year: number | null;
  city: string | null;
  notes: string | null;
  url: string | null;
  leadDays: number;
  /** Next occurrence, "yyyy-MM-dd" (Miami calendar day). */
  occursKey: string;
  /** Day the reminder goes out (occurrence − leadDays), "yyyy-MM-dd". */
  remindKey: string;
  /** A reminder row already exists for this occurrence. */
  reminded: boolean;
  daysUntil: number;
};
