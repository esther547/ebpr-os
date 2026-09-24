/**
 * Append researched contact notes to this week's priorities (internal page only).
 *   npx tsx scripts/apply-priority-contacts.ts <mapping.json> [--apply]
 * mapping.json: [{ "priorityTitleContains": "<substring of the priority title>", "client": "<client name or 'General'>", "contactNotes": "..." }]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const file = args.find((a) => a.endsWith(".json"))!;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function main() {
  const rows: { priorityTitleContains: string; client: string; contactNotes: string }[] = JSON.parse(readFileSync(file, "utf8"));
  const prios = await db.weeklyPriority.findMany({
    where: { weekOf: { gte: new Date("2026-09-21T00:00:00Z") }, isDone: false },
    include: { client: { select: { name: true } } },
  });
  let done = 0, miss = 0;
  for (const r of rows) {
    const hit = prios.find((p) => (p.client?.name ?? "General") === r.client && norm(p.title).includes(norm(r.priorityTitleContains)));
    if (!hit) { miss++; console.log(`  ?? no priority for [${r.client}] "${r.priorityTitleContains}"`); continue; }
    const base = (hit.notes ?? "").split("\n— Contactos —")[0].trim();
    const notes = `${base}${base ? "\n" : ""}— Contactos —\n${r.contactNotes.trim()}`.slice(0, 20000);
    console.log(`  ✓ [${r.client}] ${hit.title.slice(0, 50)}  (+${r.contactNotes.length} chars)`);
    if (APPLY) await db.weeklyPriority.update({ where: { id: hit.id }, data: { notes } });
    done++;
  }
  console.log(`\n${done} matched, ${miss} missing. ${APPLY ? "Applied." : "Dry run."}`);
}
main().finally(() => db.$disconnect());
