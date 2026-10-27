import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizePitches, findOverlaps, pitchSchema, pitchSelect, serializePitch } from "@/lib/press-pitches";

export const dynamic = "force-dynamic";

/** GET ?contact=<name>&journalistId=<id> → recent pitches to that contact (the "¿ya le pitcheó alguien?" check). Without params: all pitches. */
export async function GET(req: NextRequest) {
  const auth = await authorizePitches();
  if (auth.error) return auth.error;
  const sp = req.nextUrl.searchParams;
  const contact = (sp.get("contact") ?? "").trim();
  if (contact) return NextResponse.json({ data: await findOverlaps({ journalistId: sp.get("journalistId"), contactName: contact, days: 3650 }) });
  const rows = await db.pressPitch.findMany({ select: pitchSelect, orderBy: { pitchedAt: "desc" }, take: 500 });
  return NextResponse.json({ data: rows.map(serializePitch) });
}

export async function POST(req: NextRequest) {
  const auth = await authorizePitches();
  if (auth.error) return auth.error;
  const parsed = pitchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const client = await db.client.findUnique({ where: { id: d.clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  if (!d.force) {
    const overlaps = await findOverlaps({ journalistId: d.journalistId, contactName: d.contactName });
    if (overlaps.length) return NextResponse.json({ error: "overlap", overlaps }, { status: 409 });
  }
  const row = await db.pressPitch.create({ select: pitchSelect, data: {
    journalistId: d.journalistId ?? null, contactName: d.contactName, outlet: d.outlet ?? null, clientId: d.clientId, pitchedById: d.pitchedById ?? auth.user.id,
    pitchedAt: d.pitchedAt ? new Date(`${d.pitchedAt}T12:00:00Z`) : new Date(), status: d.status ?? "PITCHED", subject: d.subject ?? null, notes: d.notes ?? null,
    followUpAt: d.followUpAt ? new Date(`${d.followUpAt}T12:00:00Z`) : null, createdById: auth.user.id,
  } });
  return NextResponse.json({ data: serializePitch(row) }, { status: 201 });
}
