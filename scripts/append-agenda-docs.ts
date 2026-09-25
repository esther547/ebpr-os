/**
 * Append-only sync of every linked agenda Google Doc (what the nightly cron does).
 *   DATABASE_URL=<prod> DIRECT_URL=<prod> npx tsx --env-file=.env scripts/append-agenda-docs.ts [--apply] [clientNameFilter]
 * Without --apply it only prints what would be added to each doc.
 */
import { db } from "@/lib/db";
import { appendNewPautasToDoc } from "@/lib/agenda-doc-append";

async function main() {
  const apply = process.argv.includes("--apply");
  const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const clients = await db.client.findMany({
    where: { status: "ACTIVE", agendaDocUrl: { not: null }, ...(filter ? { name: { contains: filter, mode: "insensitive" } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  for (const c of clients) {
    const r = await appendNewPautasToDoc(c.id, { dryRun: !apply });
    if (!r.ok) { console.log(`✗ ${c.name}: ${r.error}`); continue; }
    console.log(`${apply ? "✓" : "·"} ${c.name}: doc=${r.docRows} pautas, ${apply ? `agregadas ${r.added}` : `faltan ${r.planned?.length ?? 0}`}${r.skipped ? `, ${r.skipped} pendientes` : ""}`);
    for (const line of r.planned ?? []) console.log(`     + ${line}`);
    await new Promise((res) => setTimeout(res, apply ? 1500 : 300));
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
