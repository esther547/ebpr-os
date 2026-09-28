/**
 * Re-bucket closed goals so every report month (from the floor) holds `monthlyTarget` goals,
 * in closing order (Esther, Sept 28 2026: "en cada mes figuren las seis metas que le
 * corresponden, independientemente de cuándo se realice la pauta").
 *   npx tsx scripts/refill-report-months.ts            # dry run (all active clients)
 *   npx tsx scripts/refill-report-months.ts --apply    # writes a JSON backup first
 */
import { writeFileSync } from "fs";
import { db } from "../lib/db";
import { CLOSED_GOAL_STATUSES } from "../lib/goal-status";
import { REPORT_MONTH_FLOOR } from "../lib/report-month";

const idx = (y: number, m: number) => y * 12 + m;
const addMonths = (y: number, m: number, d: number) => { const i = y * 12 + (m - 1) + d; return { year: Math.floor(i / 12), month: (i % 12) + 1 }; };

async function main() {
  const apply = process.argv.includes("--apply");
  const clients = await db.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, monthlyTarget: true } });
  const changes: { id: string; client: string; title: string; from: string; to: string; year: number; month: number }[] = [];
  const backup: { id: string; year: number; month: number }[] = [];
  for (const c of clients) {
    const target = c.monthlyTarget ?? 0;
    if (target <= 0) continue;
    const goals = await db.deliverable.findMany({
      where: { clientId: c.id, status: { in: [...CLOSED_GOAL_STATUSES] } },
      select: { id: true, title: true, year: true, month: true, closedAt: true, completedAt: true, createdAt: true },
    });
    const inScope = goals.filter((g) => idx(g.year, g.month) >= idx(REPORT_MONTH_FLOOR.year, REPORT_MONTH_FLOOR.month));
    inScope.sort((a, b) => (a.closedAt ?? a.completedAt ?? a.createdAt).getTime() - (b.closedAt ?? b.completedAt ?? b.createdAt).getTime());
    let m = { ...REPORT_MONTH_FLOOR }; let filled = 0;
    for (const g of inScope) {
      if (filled >= target) { m = addMonths(m.year, m.month, 1); filled = 0; }
      filled++;
      if (g.year !== m.year || g.month !== m.month) {
        changes.push({ id: g.id, client: c.name, title: g.title, from: `${g.year}-${String(g.month).padStart(2, "0")}`, to: `${m.year}-${String(m.month).padStart(2, "0")}`, year: m.year, month: m.month });
        backup.push({ id: g.id, year: g.year, month: g.month });
      }
    }
  }
  for (const ch of changes) console.log(`${ch.client} | ${ch.title.slice(0, 40)} | ${ch.from} → ${ch.to}`);
  console.log(`${apply ? "APPLYING" : "WOULD CHANGE"} ${changes.length} goals`);
  if (!apply || !changes.length) return;
  const file = `/private/tmp/claude-501/docs/report-month-backup-refill-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log("backup:", file);
  for (const ch of changes) await db.deliverable.update({ where: { id: ch.id }, data: { year: ch.year, month: ch.month } });
}
main().finally(() => db.$disconnect());
