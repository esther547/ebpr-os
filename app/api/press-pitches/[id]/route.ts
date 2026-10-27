import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizePitches, pitchSchema, pitchSelect, serializePitch } from "@/lib/press-pitches";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizePitches();
  if (auth.error) return auth.error;
  const cur = await db.pressPitch.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!cur) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const parsed = pitchSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { force: _force, pitchedAt, followUpAt, ...rest } = parsed.data;
  const row = await db.pressPitch.update({ where: { id: cur.id }, select: pitchSelect, data: {
    ...rest,
    ...(pitchedAt !== undefined ? { pitchedAt: new Date(`${pitchedAt}T12:00:00Z`) } : {}),
    ...(followUpAt !== undefined ? { followUpAt: followUpAt ? new Date(`${followUpAt}T12:00:00Z`) : null } : {}),
  } });
  return NextResponse.json({ data: serializePitch(row) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizePitches();
  if (auth.error) return auth.error;
  const cur = await db.pressPitch.findUnique({ where: { id: params.id }, select: { createdById: true, pitchedById: true } });
  if (!cur) return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (auth.user.role !== "SUPER_ADMIN" && cur.createdById !== auth.user.id && cur.pitchedById !== auth.user.id) return NextResponse.json({ error: "Solo quien lo registró puede borrarlo." }, { status: 403 });
  await db.pressPitch.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
