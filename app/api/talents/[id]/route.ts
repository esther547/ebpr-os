import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseTalents, nameKey } from "@/lib/talents";
import { talentSchema } from "@/lib/talent-schema";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const cur = await db.talent.findUnique({ where: { id: params.id } });
  if (!cur) return NextResponse.json({ error: "No existe" }, { status: 404 });
  // Quick tier change from the table
  if (Object.keys(body).length === 1 && typeof body.tier === "string") {
    const row = await db.talent.update({ where: { id: cur.id }, data: { tier: body.tier } });
    return NextResponse.json({ talent: row });
  }
  if (Object.keys(body).length === 1 && body.verifiedNow === true) {
    const row = await db.talent.update({ where: { id: cur.id }, data: { lastVerifiedAt: new Date() } });
    return NextResponse.json({ talent: row });
  }
  const parsed = talentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { lastVerifiedAt, tier, ...rest } = parsed.data;
  const key = nameKey(rest.name);
  const clash = await db.talent.findUnique({ where: { nameKey: key }, select: { id: true, name: true } });
  if (clash && clash.id !== cur.id) return NextResponse.json({ error: `Ese nombre ya lo tiene ${clash.name}.` }, { status: 409 });
  const row = await db.talent.update({ where: { id: cur.id }, data: { ...rest, nameKey: key, tier: tier ?? cur.tier, lastVerifiedAt: lastVerifiedAt ?? cur.lastVerifiedAt } });
  return NextResponse.json({ talent: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.talent.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
