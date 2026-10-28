import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authorizeLogistics, eventClientSchema, eventSelect, serializeEvent } from "@/lib/logistics";

export const dynamic = "force-dynamic";

/** Add or update a client's row on an event (status + PR + travel logistics). Returns the whole event. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeLogistics();
  if (auth.error) return auth.error;
  const ev = await db.logisticsEvent.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!ev) return NextResponse.json({ error: "No existe el evento" }, { status: 404 });
  const parsed = eventClientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const client = await db.client.findUnique({ where: { id: d.clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  const data = { ...(d.status !== undefined ? { status: d.status } : {}), ...(d.pr !== undefined ? { pr: d.pr } : {}), ...(d.travelExpenses !== undefined ? { travelExpenses: d.travelExpenses } : {}), ...(d.notes !== undefined ? { notes: d.notes } : {}) };
  await db.logisticsEventClient.upsert({ where: { eventId_clientId: { eventId: ev.id, clientId: d.clientId } }, create: { eventId: ev.id, clientId: d.clientId, status: d.status ?? "PENDING", pr: d.pr ?? null, travelExpenses: d.travelExpenses ?? null, notes: d.notes ?? null }, update: data });
  const row = await db.logisticsEvent.findUniqueOrThrow({ where: { id: ev.id }, select: eventSelect });
  return NextResponse.json({ data: serializeEvent(row) });
}

/** Remove a client from an event. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeLogistics();
  if (auth.error) return auth.error;
  const parsed = z.object({ clientId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Falta el cliente" }, { status: 400 });
  await db.logisticsEventClient.deleteMany({ where: { eventId: params.id, clientId: parsed.data.clientId } });
  const row = await db.logisticsEvent.findUnique({ where: { id: params.id }, select: eventSelect });
  return NextResponse.json({ data: row ? serializeEvent(row) : null });
}
