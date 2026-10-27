import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageJournalists } from "@/lib/permissions";
import { OVERLAP_DAYS, PITCH_STATUSES, type Overlap, type PitchRow } from "@/lib/press-pitches-shared";
export * from "@/lib/press-pitches-shared";

/** Admins and strategists (the publicists); same rule as the Medios base. */
export const canUsePitches = (u: SessionUser) => canManageJournalists(u);

export async function authorizePitches() {
  try {
    const user = await requireUser();
    if (!canUsePitches(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export const pitchSchema = z.object({
  journalistId: z.string().min(1).nullable().optional(),
  contactName: z.string().trim().min(1, "¿A quién le pitcheaste?").max(200),
  outlet: z.string().trim().max(200).nullable().optional(),
  clientId: z.string().min(1, "Elige el cliente"),
  pitchedById: z.string().min(1).optional(),
  pitchedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(PITCH_STATUSES).optional(),
  subject: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  followUpAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  /** The caller saw the overlap warning and wants the pitch anyway. */
  force: z.boolean().optional(),
});

export const pitchSelect = {
  id: true, journalistId: true, contactName: true, outlet: true, pitchedAt: true, status: true, subject: true, notes: true, followUpAt: true, createdAt: true,
  client: { select: { id: true, name: true } }, pitchedBy: { select: { id: true, name: true } },
};
type Raw = { id: string; journalistId: string | null; contactName: string; outlet: string | null; pitchedAt: Date; status: string; subject: string | null; notes: string | null; followUpAt: Date | null; createdAt: Date; client: { id: string; name: string }; pitchedBy: { id: string; name: string } };
export const serializePitch = (r: Raw): PitchRow => ({ ...r, pitchedAt: r.pitchedAt.toISOString(), followUpAt: r.followUpAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() });

export const nameKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Recent pitches to the same contact (by Medios id or by name), newest first. */
export async function findOverlaps(args: { journalistId?: string | null; contactName: string; excludeId?: string; days?: number }): Promise<Overlap[]> {
  const since = new Date(Date.now() - (args.days ?? OVERLAP_DAYS) * 86_400_000);
  const key = nameKey(args.contactName);
  const rows = await db.pressPitch.findMany({
    where: { pitchedAt: { gte: since }, ...(args.excludeId ? { id: { not: args.excludeId } } : {}), OR: [...(args.journalistId ? [{ journalistId: args.journalistId }] : []), { contactName: { contains: args.contactName.trim(), mode: "insensitive" as const } }] },
    select: pitchSelect, orderBy: { pitchedAt: "desc" }, take: 20,
  });
  return rows.filter((r) => (args.journalistId && r.journalistId === args.journalistId) || nameKey(r.contactName) === key)
    .map((r) => ({ id: r.id, contactName: r.contactName, outlet: r.outlet, client: r.client.name, pitchedBy: r.pitchedBy.name, pitchedAt: r.pitchedAt.toISOString(), status: r.status }));
}
