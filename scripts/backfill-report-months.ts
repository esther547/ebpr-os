/**
 * One-time: re-bucket existing goals into REPORT months (Esther, Sept 28 2026).
 * Per active client, goals (not CANCELLED/IDEA) are poured in closing order into consecutive
 * months starting at the client's earliest goal month, `monthlyTarget` per month; the rest of
 * the goals keep their current month. Backup of the previous month/year is written first.
 *   npx tsx scripts/backfill-report-months.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
const db = new PrismaClient();
const apply = process.argv.includes("--apply");
function addMonths(year: number, month: number, delta: number) { const idx = year * 12 + (month - 1) + delta; return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }; }
async function main() {
  const clients = await db.client.findMany({ where: { status: "ACTIVE", monthlyTarget: { gt: 0 } }, select: { id: true, name: true, monthlyTarget: true } });
  const backup: { id: string; month: number; year: number }[] = [];
  const changes: string[] = [];
  for (const c of clients) {
    const goals = await db.deliverable.findMany({
      // Only the portal era (from Sept 2026); older goals are history and stay where they are.
      where: { clientId: c.id, status: { notIn: ["CANCELLED", "IDEA"] }, OR: [{ year: { gt: 2026 } }, { year: 2026, month: { gte: 9 } }] },
      select: { id: true, title: true, month: true, year: true, closedAt: true, createdAt: true, completedAt: true },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    if (!goals.length) continue;
    const ordered = [...goals].sort((a, b) => (a.closedAt ?? a.completedAt ?? a.createdAt).getTime() - (b.closedAt ?? b.completedAt ?? b.createdAt).getTime());
    let m = { year: goals[0].year, month: goals[0].month };
    let n = 0;
    const before = new Map<string, number>(); const after = new Map<string, number>();
    for (const g of goals) before.set(`${g.year}-${String(g.month).padStart(2, "0")}`, (before.get(`${g.year}-${String(g.month).padStart(2, "0")}`) ?? 0) + 1);
    for (const g of ordered) {
      if (n >= c.monthlyTarget) { m = addMonths(m.year, m.month, 1); n = 0; }
      n++;
      const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
      after.set(key, (after.get(key) ?? 0) + 1);
      if (g.month !== m.month || g.year !== m.year) {
        backup.push({ id: g.id, month: g.month, year: g.year });
        changes.push(`  ${c.name}: "${g.title.slice(0, 40)}" ${g.year}-${g.month} → ${m.year}-${m.month}`);
        if (apply) await db.deliverable.update({ where: { id: g.id }, data: { month: m.month, year: m.year } });
      }
    }
    const fmt = (map: Map<string, number>) => [...map.entries()].sort().map(([k, v]) => `${k}:${v}`).join(" ");
    if (fmt(before) !== fmt(after)) console.log(`${c.name} (target ${c.monthlyTarget})\n   antes:   ${fmt(before)}\n   después: ${fmt(after)}`);
  }
  console.log(`\n${changes.length} goals ${apply ? "moved" : "would move"}:`); for (const ch of changes) console.log(ch);
  if (apply) writeFileSync(`/private/tmp/claude-501/docs/report-month-backup-${Date.now()}.json`, JSON.stringify(backup, null, 1));
}
main().finally(() => db.$disconnect());
