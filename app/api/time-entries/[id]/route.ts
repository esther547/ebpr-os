import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canRunTimer, timeEntrySelect, toDTO } from "@/lib/time-tracking";

const patchSchema = z.object({
  stop: z.boolean().optional(),
  description: z.string().trim().min(1).max(300).optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

async function own(id: string) {
  let user;
  try { user = await requireUser(); } catch { return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const; }
  if (!canRunTimer(user)) return { error: NextResponse.json({ error: "Solo Carolina edita sus horas" }, { status: 403 }) } as const;
  const e = await db.timeEntry.findUnique({ where: { id }, select: { id: true, userId: true, startedAt: true, endedAt: true } });
  if (!e || e.userId !== user.id) return { error: NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 }) } as const;
  return { user, e } as const;
}

/** PATCH — stop the running timer ({stop:true}) or fix an entry (description / start / end). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const o = await own(params.id);
  if ("error" in o) return o.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const data: { description?: string; startedAt?: Date; endedAt?: Date | null } = {};
  if (d.description !== undefined) data.description = d.description;
  if (d.startedAt !== undefined) data.startedAt = new Date(d.startedAt);
  if (d.endedAt !== undefined) data.endedAt = d.endedAt ? new Date(d.endedAt) : null;
  if (d.stop) data.endedAt = o.e.endedAt ?? new Date();
  const start = data.startedAt ?? o.e.startedAt;
  const end = data.endedAt === undefined ? o.e.endedAt : data.endedAt;
  if (end && end <= start) return NextResponse.json({ error: "La hora de fin debe ser después del inicio" }, { status: 400 });
  const e = await db.timeEntry.update({ where: { id: o.e.id }, data, select: timeEntrySelect });
  return NextResponse.json({ data: toDTO(e) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const o = await own(params.id);
  if ("error" in o) return o.error;
  await db.timeEntry.delete({ where: { id: o.e.id } });
  return NextResponse.json({ data: { id: o.e.id } });
}
