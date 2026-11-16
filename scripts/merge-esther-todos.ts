/**
 * Esther, Nov 16 2026: "merge Esther to dos con Mis to dos". Her own PERSONAL-list lines (Mis to dos → "Mis pendientes")
 * move into the ESTHER board under the PERSONAL section, every week. A line that already exists there (same week and
 * title) is not duplicated: the pending copy wins and the other is removed. Team lines stay on Prioridades.
 *   npx tsx scripts/merge-esther-todos.ts [--apply]
 */
import { db } from "../lib/db";

async function main() {
  const apply = process.argv.includes("--apply");
  const esther = await db.user.findFirst({ where: { email: { equals: "esther@ebmanagement.io", mode: "insensitive" } }, select: { id: true, name: true } });
  if (!esther) throw new Error("Esther not found");
  const mine = await db.weeklyPriority.findMany({ where: { list: "PERSONAL", assigneeId: esther.id }, orderBy: { weekOf: "asc" } });
  const board = await db.weeklyPriority.findMany({ where: { list: "ESTHER" }, select: { id: true, weekOf: true, title: true, isDone: true } });
  const key = (w: Date, t: string) => `${w.toISOString().slice(0, 10)}|${t.trim().toLowerCase()}`;
  const existing = new Map(board.map((b) => [key(b.weekOf, b.title), b]));
  let moved = 0, dup = 0;
  for (const m of mine) {
    const twin = existing.get(key(m.weekOf, m.title));
    if (twin) { dup++; console.log(`dup  ${m.weekOf.toISOString().slice(0, 10)} ${m.title.slice(0, 60)}`); if (apply) { if (!m.isDone && twin.isDone) await db.weeklyPriority.update({ where: { id: twin.id }, data: { isDone: false, doneAt: null } }); await db.weeklyPriority.delete({ where: { id: m.id } }); } continue; }
    moved++; console.log(`move ${m.weekOf.toISOString().slice(0, 10)} ${m.isDone ? "[x]" : "[ ]"} ${m.title.slice(0, 70)}`);
    if (apply) await db.weeklyPriority.update({ where: { id: m.id }, data: { list: "ESTHER", category: "PERSONAL", assigneeId: null } });
  }
  console.log({ esther: esther.name, personalLines: mine.length, moved, duplicatesMerged: dup, applied: apply });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
