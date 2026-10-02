/** Preview (no write) of how a client's Google Doc agenda would look organised by service period.
 *   npx tsx scripts/preview-agenda-doc.ts "<client>"
 */
import { db } from "../lib/db";
import { buildAgendaSections } from "../lib/google-docs-writer";
async function main() {
  const name = process.argv[2];
  const c = await db.client.findFirst({ where: { name: { contains: name, mode: "insensitive" } }, select: { id: true, name: true } });
  if (!c) throw new Error("cliente no encontrado");
  const sections = await buildAgendaSections(c.id);
  console.log(c.name);
  for (const s of sections) {
    console.log(`${s.heading} — ${s.rows.length} filas`);
    for (const r of s.rows) console.log(`   ${r.number}. ${r.fecha.replace(/\n/g, " ")} · ${r.item.split("\n")[0].slice(0, 44)} · ${r.estado}`);
  }
}
main().finally(() => db.$disconnect());
