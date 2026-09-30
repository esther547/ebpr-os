/**
 * Service months (lib/service-months.ts): show or apply each client's month plan.
 *   npx tsx scripts/reconcile-months.ts "<client>"          # plan only
 *   npx tsx scripts/reconcile-months.ts --all                # plan for every active client
 *   npx tsx scripts/reconcile-months.ts --all --apply        # persist (goals month/year, pautas agendaMonth/Year)
 */
import { db } from "../lib/db";
import { planServiceMonths, reconcileClientMonths } from "../lib/service-months";

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
async function main() {
  const apply = process.argv.includes("--apply"); const all = process.argv.includes("--all");
  const name = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const clients = await db.client.findMany({ where: all ? { status: "ACTIVE" } : { name: { contains: name ?? "", mode: "insensitive" } }, select: { id: true, name: true, monthlyTarget: true }, orderBy: { name: "asc" } });
  for (const c of clients) {
    const plan = await planServiceMonths(c.id);
    if (!plan || !plan.units.length) { console.log(`${c.name}: (sin unidades)`); continue; }
    const keys = [...plan.counts.keys()].sort();
    const line = keys.map((k) => { const [y, m] = k.split("-").map(Number); return `${MONTHS[m - 1]} ${String(y).slice(2)}: ${plan.counts.get(k)}`; }).join(" · ");
    const goals = await db.deliverable.findMany({ where: { id: { in: plan.units.map((u) => u.goalId).filter((x): x is string => !!x) } }, select: { id: true, title: true, month: true, year: true } });
    const gm = new Map(goals.map((g) => [g.id, g]));
    const moves = plan.units.filter((u) => u.goalId && gm.get(u.goalId) && (gm.get(u.goalId)!.month !== u.assigned.month || gm.get(u.goalId)!.year !== u.assigned.year));
    console.log(`${c.name} (meta ${plan.target}, MES 1 = ${plan.start ? MONTHS[plan.start.month - 1] + " " + plan.start.year : "—"}): ${line}${moves.length ? `  | ${moves.length} metas cambian de mes` : ""}`);
    for (const u of moves.slice(0, 6)) { const g = gm.get(u.goalId!)!; console.log(`    ${g.title.slice(0, 40)}: ${MONTHS[g.month - 1]} → ${MONTHS[u.assigned.month - 1]}`); }
    if (apply) { const n = await reconcileClientMonths(c.id); console.log(`    aplicado: ${n} filas`); }
  }
}
main().finally(() => db.$disconnect());
