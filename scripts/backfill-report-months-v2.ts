/** Report month = the client's cycle in which the goal was CLOSED (closedAt → completedAt → createdAt). Portal era only. */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { cycleForDate } from "../lib/cycles";
const db = new PrismaClient();
const apply = process.argv.includes("--apply");
async function main() {
  const clients = await db.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, cycleDay: true } });
  const backup: { id: string; month: number; year: number }[] = []; let moved = 0;
  for (const c of clients) {
    const goals = await db.deliverable.findMany({ where: { clientId: c.id, status: { notIn: ["CANCELLED", "IDEA"] }, OR: [{ year: { gt: 2026 } }, { year: 2026, month: { gte: 9 } }] }, select: { id: true, title: true, month: true, year: true, closedAt: true, completedAt: true, createdAt: true } });
    const before = new Map<string, number>(), after = new Map<string, number>();
    for (const g of goals) {
      const cyc = cycleForDate(c.cycleDay, g.closedAt ?? g.completedAt ?? g.createdAt);
      const kb = `${g.year}-${String(g.month).padStart(2, "0")}`, ka = `${cyc.year}-${String(cyc.month).padStart(2, "0")}`;
      before.set(kb, (before.get(kb) ?? 0) + 1); after.set(ka, (after.get(ka) ?? 0) + 1);
      if (cyc.month !== g.month || cyc.year !== g.year) {
        moved++; backup.push({ id: g.id, month: g.month, year: g.year });
        console.log(`  ${c.name}: "${g.title.slice(0, 40)}" ${kb} → ${ka} (cerrada ${(g.closedAt ?? g.completedAt ?? g.createdAt).toISOString().slice(0, 10)})`);
        if (apply) await db.deliverable.update({ where: { id: g.id }, data: { month: cyc.month, year: cyc.year } });
      }
    }
    const f = (m: Map<string, number>) => [...m.entries()].sort().map(([k, v]) => `${k}:${v}`).join(" ");
    if (f(before) !== f(after)) console.log(`${c.name}: antes ${f(before)} | después ${f(after)}`);
  }
  console.log(`\n${moved} goals ${apply ? "moved" : "would move"}`);
  if (apply) writeFileSync(`/private/tmp/claude-501/docs/report-month-backup-v2-${Date.now()}.json`, JSON.stringify(backup, null, 1));
}
main().finally(() => db.$disconnect());
