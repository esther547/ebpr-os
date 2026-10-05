/** Run the deterministic distribution (lib/service-periods.ts redistributeClient) for one or all active clients.
 *   npx tsx scripts/redistribute-periods.ts ["<client>"]
 */
import { db } from "../lib/db";
import { periodBoard, redistributeClient } from "../lib/service-periods";
async function main() {
  const only = process.argv[2];
  const clients = await db.client.findMany({ where: { status: "ACTIVE", ...(only ? { name: { contains: only, mode: "insensitive" } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  let total = 0;
  for (const c of clients) {
    const moved = await redistributeClient(c.id);
    total += moved;
    const b = await periodBoard(c.id);
    const line = b.periods.map((p) => `${p.label.slice(0, 3)}${p.achieved}/${p.target}`).join(" ");
    console.log(`${moved ? "↻" : "="} ${c.name}: ${moved} movidas · ${line}${b.periods.some((p) => p.toReview) ? ` · por revisar ${b.periods.reduce((s, p) => s + p.toReview, 0)}` : ""}`);
  }
  console.log("total movidas:", total);
}
main().finally(() => db.$disconnect());
