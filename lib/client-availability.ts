// Client availability windows ("Disponibilidad y viajes"): server-side lookups and
// the booking rule shared by the deliverable and agenda APIs.
//
//   OFF    -> the client is not available: nothing may be booked on those days.
//   TRAVEL -> the client is available but elsewhere: bookings proceed with a warning
//             so the team looks for opportunities in that place.
//
// Windows are date-only (12:00 UTC) and inclusive. Every comparison is done on Miami
// calendar day keys ("yyyy-MM-dd"), never on raw instants.

import type { ClientAvailability } from "@prisma/client";
import { db } from "@/lib/db";
import { addDaysKey, dayKeyInTz } from "@/components/runners/miami-time";
import {
  describeWindow,
  type AvailabilityNow,
  type AvailabilityWindow,
} from "@/lib/client-availability-format";

export * from "@/lib/client-availability-format";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Miami day key for an instant, or the key itself when given a plain "yyyy-MM-dd". */
export function dayKeyOf(date: Date | string): string {
  if (typeof date === "string" && DATE_ONLY.test(date)) return date;
  return dayKeyInTz(date);
}

/** "yyyy-MM-dd" -> 12:00 UTC (the project's date-only storage convention). */
export function noonUtc(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

/** Stored date-only value -> its calendar day key. */
function storedKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toWindow(
  row: Pick<ClientAvailability, "id" | "kind" | "startDate" | "endDate" | "location" | "notes">
): AvailabilityWindow {
  return {
    id: row.id,
    kind: row.kind,
    startKey: storedKey(row.startDate),
    endKey: storedKey(row.endDate),
    location: row.location,
    notes: row.notes,
  };
}

/**
 * The window that contains the given Miami day (startKey <= day <= endKey), or null.
 * When windows overlap, OFF wins over TRAVEL (it is the stricter one).
 */
export async function getAvailabilityFor(
  clientId: string,
  date: Date | string
): Promise<AvailabilityWindow | null> {
  const key = dayKeyOf(date);
  const rows = await db.clientAvailability.findMany({
    where: {
      clientId,
      // Coarse range filter in UTC; the exact check is on day keys below.
      startDate: { lt: new Date(`${addDaysKey(key, 1)}T00:00:00.000Z`) },
      endDate: { gte: new Date(`${key}T00:00:00.000Z`) },
    },
    orderBy: { startDate: "asc" },
  });
  const matches = rows.map(toWindow).filter((w) => w.startKey <= key && key <= w.endKey);
  return matches.find((w) => w.kind === "OFF") ?? matches[0] ?? null;
}

export type ClientDateCheck = {
  blocked: boolean;
  warning: string | null;
  window: AvailabilityWindow | null;
};

/**
 * The booking rule. OFF -> blocked (with the message in `warning`); TRAVEL -> allowed
 * with a warning; no window -> allowed, no warning.
 */
export async function checkClientDate(
  clientId: string,
  date: Date | string | null | undefined
): Promise<ClientDateCheck> {
  if (!date) return { blocked: false, warning: null, window: null };
  const window = await getAvailabilityFor(clientId, date);
  if (!window) return { blocked: false, warning: null, window: null };
  if (window.kind === "OFF") {
    return {
      blocked: true,
      warning: `El cliente no está disponible: ${describeWindow(window)}`,
      window,
    };
  }
  return {
    blocked: false,
    warning: `El cliente estará ${describeWindow(window)}; busca oportunidades allí`,
    window,
  };
}

/** Windows that end today (Miami) or later, ordered by start. */
export async function currentAndUpcoming(
  clientId: string,
  now: Date = new Date()
): Promise<AvailabilityWindow[]> {
  const todayKey = dayKeyInTz(now);
  const rows = await db.clientAvailability.findMany({
    where: { clientId, endDate: { gte: new Date(`${todayKey}T00:00:00.000Z`) } },
    orderBy: { startDate: "asc" },
  });
  return rows.map(toWindow).filter((w) => w.endKey >= todayKey);
}

/** Header badge data for "right now", or undefined when the client is not in a window. */
export async function availabilityNowFor(
  clientId: string,
  now: Date = new Date()
): Promise<AvailabilityNow | undefined> {
  const w = await getAvailabilityFor(clientId, now);
  return w ? { kind: w.kind, location: w.location, endKey: w.endKey } : undefined;
}
