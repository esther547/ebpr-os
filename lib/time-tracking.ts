/**
 * Time tracking on Carolina's to-do board (Esther, Sept 29 2026: "ella cobra por hora… usa
 * Clockify, ponlo en su to do"). Carolina runs the timer; Esther (the board's other viewer) sees
 * the hours and can export them. Hours only: no rates, no amounts (no finance in the platform).
 */
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { canAccessPriorityList } from "@/lib/priorities";

export const TIMESHEET_OWNER_EMAIL = "carolina@ebmanagement.io";

export const canViewTimesheet = (u: SessionUser) => canAccessPriorityList(u, "CAROLINA");
export const canRunTimer = (u: SessionUser) => (u.email ?? "").toLowerCase() === TIMESHEET_OWNER_EMAIL;

export async function timesheetOwner() {
  return db.user.findFirst({ where: { email: { equals: TIMESHEET_OWNER_EMAIL, mode: "insensitive" } }, select: { id: true, name: true } });
}

export const timeEntrySelect = { id: true, description: true, startedAt: true, endedAt: true } as const;

export type TimeEntryDTO = { id: string; description: string; startedAt: string; endedAt: string | null };
export const toDTO = (e: { id: string; description: string; startedAt: Date; endedAt: Date | null }): TimeEntryDTO => ({
  id: e.id,
  description: e.description,
  startedAt: e.startedAt.toISOString(),
  endedAt: e.endedAt ? e.endedAt.toISOString() : null,
});
