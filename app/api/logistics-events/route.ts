import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeLogistics, eventSchema, eventSelect, serializeEvent } from "@/lib/logistics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorizeLogistics();
  if (auth.error) return auth.error;
  const group = req.nextUrl.searchParams.get("group") ?? "LATIN_GRAMMYS";
  const rows = await db.logisticsEvent.findMany({ where: { group }, select: eventSelect, orderBy: [{ eventDate: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return NextResponse.json({ data: rows.map(serializeEvent) });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeLogistics();
  if (auth.error) return auth.error;
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const row = await db.logisticsEvent.create({ select: eventSelect, data: { group: d.group ?? "LATIN_GRAMMYS", name: d.name, eventDate: d.eventDate ? new Date(`${d.eventDate}T12:00:00Z`) : null, eventTime: d.eventTime ?? null, venue: d.venue ?? null, contact: d.contact ?? null, notes: d.notes ?? null, sortOrder: d.sortOrder ?? 0, createdById: auth.user.id } });
  return NextResponse.json({ data: serializeEvent(row) }, { status: 201 });
}
