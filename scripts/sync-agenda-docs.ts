/**
 * Regenerate every linked client agenda Google Doc from the portal now (same code as the nightly cron).
 *   DATABASE_URL=<prod> DIRECT_URL=<prod> npx tsx scripts/sync-agenda-docs.ts [budgetMs]
 * Docs are only rewritten from their first "MES" block; a doc holding more pautas than the portal is never touched.
 */
import { syncAllAgendaDocs } from "@/lib/google-docs-writer";

async function main() {
  const budgetMs = Number(process.argv[2] ?? 480_000);
  const report = await syncAllAgendaDocs({ budgetMs });
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
