import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canManageJournalists } from "@/lib/permissions";
import { CLIENT_STATUSES, type EventRow } from "@/lib/logistics-shared";
export * from "@/lib/logistics-shared";

/** Same people as Pitches: admins and strategists. */
export const canUseLogistics = (u: SessionUser) => canManageJournalists(u);

export async function authorizeLogistics() {
  try {
    const user = await requireUser();
    if (!canUseLogistics(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

const optText = (max: number) => z.string().trim().max(max).nullable().optional();
export const eventSchema = z.object({
  group: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1, "Ponle nombre al evento").max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  eventTime: optText(40),
  venue: optText(300),
  contact: optText(500),
  notes: optText(4000),
  sortOrder: z.number().int().optional(),
});
export const eventClientSchema = z.object({
  clientId: z.string().min(1, "Elige el cliente"),
  status: z.enum(CLIENT_STATUSES).optional(),
  pr: optText(2000),
  travelExpenses: optText(2000),
  notes: optText(2000),
});

export const eventSelect = {
  id: true, group: true, name: true, eventDate: true, eventTime: true, venue: true, contact: true, notes: true, sortOrder: true,
  clients: { select: { id: true, status: true, pr: true, travelExpenses: true, notes: true, client: { select: { id: true, name: true } } }, orderBy: { client: { name: "asc" as const } } },
};
type Raw = { id: string; group: string; name: string; eventDate: Date | null; eventTime: string | null; venue: string | null; contact: string | null; notes: string | null; sortOrder: number; clients: { id: string; status: string; pr: string | null; travelExpenses: string | null; notes: string | null; client: { id: string; name: string } }[] };
export const serializeEvent = (r: Raw): EventRow => ({ ...r, eventDate: r.eventDate?.toISOString() ?? null });
