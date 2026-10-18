import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseTalents } from "@/lib/talents";
import { suggestCampaign } from "@/lib/campaign-suggester";

export const maxDuration = 300;
const schema = z.object({ brand: z.string().trim().min(2, "Escribe la marca").max(2000), brief: z.string().trim().max(5000).optional().nullable(), talentIds: z.array(z.string()).max(500).optional() });

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.campaignSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { name: true } } } });
  return NextResponse.json({ campaigns: rows });
}

/** One text box in, one structured suggestion out, saved as DRAFT. */
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { brand, brief, talentIds } = parsed.data;
  const result = await suggestCampaign(brand, brief, talentIds?.length ? { ids: talentIds } : undefined);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  const row = await db.campaignSuggestion.create({ data: { brand, brief: brief || null, result: result.suggestion, createdById: user.id, model: result.model } });
  return NextResponse.json({ campaign: row, usage: result.usage }, { status: 201 });
}
