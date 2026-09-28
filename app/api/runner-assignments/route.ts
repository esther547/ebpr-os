import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { mergeInternalNotes, splitClientNotes } from "@/lib/client-safe-notes";
import { requireUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { miamiWeekOf } from "@/app/api/deliverables/_lib/agenda-sync";
import { notifyRunnerAssigned, notifyRunnersOpenActivity } from "@/lib/runner-notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  runnerId: z.string().trim().min(1).optional().nullable(),
  eventName: z.string().trim().min(1, "Escribe el evento"),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  arrivalTime: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  location: z.string().optional(),
  itemType: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  accompanistCount: z.number().int().min(0).optional().default(0),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional().default("SCHEDULED"),
});

/** POST — an agency event (no client) on the runner schedule, e.g. a gala or an activation these days. */
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canManageRunners(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const [y, m, day] = d.eventDate.split("-").map(Number);
  const eventDate = new Date(Date.UTC(y, m - 1, day, 12));
  if (d.runnerId) {
    const runner = await db.user.findUnique({ where: { id: d.runnerId }, select: { id: true } });
    if (!runner) return NextResponse.json({ error: "Runner no encontrado" }, { status: 400 });
  }
  const split = splitClientNotes(d.notes);
  const item = await db.runnerAssignment.create({
    data: {
      clientId: null,
      runnerId: d.runnerId || null,
      assignedAt: d.runnerId ? new Date() : null,
      eventName: d.eventName,
      eventDate,
      weekOf: miamiWeekOf(eventDate),
      arrivalTime: d.arrivalTime ? new Date(d.arrivalTime) : null,
      eventTime: d.eventTime ? new Date(d.eventTime) : null,
      venueName: d.venueName || null,
      venueAddress: d.venueAddress || null,
      location: d.location || d.venueName || null,
      itemType: d.itemType || null,
      notes: split.client,
      internalNotes: mergeInternalNotes(d.internalNotes, split.internal),
      accompanistCount: d.accompanistCount,
      status: d.status,
    },
    include: { runner: { select: { id: true, name: true } } },
  });
  try {
    if (item.runnerId) await notifyRunnerAssigned(item.id);
    else if (item.status !== "CANCELLED") await notifyRunnersOpenActivity(item.id);
  } catch (err) {
    console.error("Runner notification failed:", err);
  }
  await db.activityLog.create({ data: { userId: user.id, action: "agenda_item_created", description: `Agregó el evento "${d.eventName}" al horario de runners` } }).catch(() => undefined);
  return NextResponse.json({ data: item }, { status: 201 });
}
