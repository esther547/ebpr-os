import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeLogistics, eventSchema, eventSelect, serializeEvent } from "@/lib/logistics";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeLogistics();
  if (auth.error) return auth.error;
  const cur = await db.logisticsEvent.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!cur) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const parsed = eventSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { eventDate, ...rest } = parsed.data;
  const row = await db.logisticsEvent.update({ where: { id: cur.id }, select: eventSelect, data: { ...rest, ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(`${eventDate}T12:00:00Z`) : null } : {}) } });
  return NextResponse.json({ data: serializeEvent(row) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeLogistics();
  if (auth.error) return auth.error;
  await db.logisticsEvent.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
