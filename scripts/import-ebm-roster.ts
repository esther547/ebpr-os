/**
 * Import EBM's roster export (EBM_Roster_YYYY-MM-DD.json) into the talents table without duplicating.
 *   DATABASE_URL=… DIRECT_URL=… npx tsx scripts/import-ebm-roster.ts /path/EBM_Roster_2026-10-18.json [--verified=2026-10-18]
 */
import { readFileSync } from "node:fs";
import { db } from "../lib/db";
import { importTalents, talentFromRecord, type TalentInput } from "../lib/talents";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Pass the roster JSON path");
  const verified = process.argv.find((a) => a.startsWith("--verified="))?.slice("--verified=".length) ?? file.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const arr: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw.talents;
  const records = arr.map(talentFromRecord).filter((r): r is TalentInput => !!r);
  const inactive = arr.filter((r) => r.status && r.status !== "active").length;
  console.log(`${records.length} records (${inactive} not active in EBM), verified date ${verified ?? "none"}`);
  const res = await importTalents(records, { source: "EBM", verifiedAt: verified ? new Date(verified) : null });
  console.log(`created ${res.created}, merged ${res.merged}`);
  for (const n of res.mergedNames) console.log("  merged:", n);
  console.log("total active:", await db.talent.count({ where: { isActive: true } }));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
