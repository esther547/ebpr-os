import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canUseTalents, findDuplicate, importTalents, talentFromRecord, type TalentInput } from "@/lib/talents";

export const maxDuration = 120;
const schema = z.object({ rows: z.array(z.record(z.unknown())).max(5000), source: z.string().trim().min(1).max(60).default("EBPR"), dryRun: z.boolean().optional(), verifiedAt: z.string().optional().nullable() });

/** Import a batch of talents (EBM JSON export or a CSV already parsed client-side). Duplicates are merged, never doubled. */
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Formato inválido: manda un arreglo de talentos." }, { status: 400 });
  const records = parsed.data.rows.map(talentFromRecord).filter((r): r is TalentInput => !!r);
  if (!records.length) return NextResponse.json({ error: "Ninguna fila tiene nombre." }, { status: 400 });
  if (parsed.data.dryRun) {
    const dups: string[] = [];
    for (const r of records) { const d = await findDuplicate(r); if (d) dups.push(`${r.name} → ${d.name} (${d.how})`); }
    return NextResponse.json({ total: records.length, wouldCreate: records.length - dups.length, wouldMerge: dups.length, duplicates: dups });
  }
  const result = await importTalents(records, { source: parsed.data.source, verifiedAt: parsed.data.verifiedAt ? new Date(parsed.data.verifiedAt) : null });
  return NextResponse.json(result);
}
