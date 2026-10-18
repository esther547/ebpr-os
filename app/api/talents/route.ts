import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseTalents, findDuplicate, nameKey, type TalentInput } from "@/lib/talents";
import { talentSchema } from "@/lib/talent-schema";


export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const rows = await db.talent.findMany({ where: { isActive: true, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { instagramHandle: { contains: q, mode: "insensitive" } }, { verticals: { has: q } }] } : {}) }, orderBy: { name: "asc" }, take: 500 });
  return NextResponse.json({ talents: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = talentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const t = parsed.data as TalentInput & { tier?: string };
  const dup = await findDuplicate(t);
  if (dup) return NextResponse.json({ error: `Ya existe: ${dup.name} (coincide por ${dup.how === "ebmId" ? "ID de EBM" : dup.how === "instagram" ? "Instagram" : "nombre"}). Edítalo en vez de duplicarlo.`, duplicateId: dup.id }, { status: 409 });
  const { lastVerifiedAt, tier, ...rest } = t;
  const row = await db.talent.create({ data: { ...rest, nameKey: nameKey(t.name), tier: tier ?? "UNSET", source: "Manual", lastVerifiedAt: lastVerifiedAt ?? null } });
  return NextResponse.json({ talent: row }, { status: 201 });
}
