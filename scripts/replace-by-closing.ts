/**
 * Re-place portal-era goals by the month they were SECURED (closedAt), not by the old quota order
 * (Esther, Oct 2 2026). Imported history (no closing date), doc-pinned pautas and the "Meta de
 * <mes> #N" placeholders stay where they are. Overflow goes to the next period with room.
 *   npx tsx scripts/replace-by-closing.ts            # plan
 *   npx tsx scripts/replace-by-closing.ts --apply
 */
import { db } from "../lib/db";
import { assignPeriod, clientUnits, defaultLabel } from "../lib/service-periods";
import { dayKeyInTz } from "../components/runners/miami-time";

const mi = (y: number, m: number) => y * 12 + (m - 1);
async function main() {
  const apply = process.argv.includes("--apply");
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const clients = await db.client.findMany({ where: { status: "ACTIVE", ...(only ? { name: { contains: only, mode: "insensitive" } } : {}) }, select: { id: true, name: true, monthlyTarget: true }, orderBy: { name: "asc" } });
  for (const c of clients) {
    let periods = await db.servicePeriod.findMany({ where: { clientId: c.id }, orderBy: { number: "asc" } });
    const units = await clientUnits(c.id);
    const pinnedPautas = new Set((await db.runnerAssignment.findMany({ where: { clientId: c.id, agendaMonthPinned: true }, select: { id: true } })).map((p) => p.id));
    const movable = units.filter((u) => u.closedAt && u.goalId && !(u.pautaId && (u.pautaId.startsWith("agimp_") || pinnedPautas.has(u.pautaId))) && !/^Meta de \p{L}+ #\d+/u.test(u.title));
    if (!movable.length) continue;
    const movableKeys = new Set(movable.map((u) => u.key));
    const load = new Map<string, number>();
    for (const u of units) if (u.periodId && !movableKeys.has(u.key)) { const p = periods.find((x) => x.id === u.periodId); load.set(u.periodId, (load.get(u.periodId) ?? 0) + (u.coversPeriod && p ? Math.max(p.target, u.goalValue) : u.goalValue)); }
    const moves: string[] = [];
    for (const u of movable.sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime())) {
      const [cy, cm] = dayKeyInTz(u.closedAt!).split("-").map(Number);
      let target = periods.find((p) => mi(p.refYear, p.refMonth) >= mi(cy, cm) && (p.target === 0 || (load.get(p.id) ?? 0) < p.target));
      if (!target) {
        const last = periods[periods.length - 1];
        const ni = last ? Math.max(mi(cy, cm), mi(last.refYear, last.refMonth) + 1) : mi(cy, cm);
        const refYear = Math.floor(ni / 12); const refMonth = (ni % 12) + 1;
        const data = { clientId: c.id, number: (last?.number ?? 0) + 1, label: defaultLabel(refYear, refMonth), refYear, refMonth, target: c.monthlyTarget ?? 0 };
        target = apply ? await db.servicePeriod.create({ data }) : ({ ...data, id: `new-${data.number}`, note: null, createdAt: new Date(), updatedAt: new Date() } as (typeof periods)[number]);
        periods = [...periods, target];
        moves.push(`  + nuevo período Mes ${data.number} · ${data.label}`);
      }
      load.set(target.id, (load.get(target.id) ?? 0) + u.goalValue);
      if (u.periodId !== target.id) {
        const from = periods.find((p) => p.id === u.periodId);
        moves.push(`  ${u.title.slice(0, 38)} (cerrada ${dayKeyInTz(u.closedAt!)}): ${from ? `Mes ${from.number} ${from.label}` : "pendiente"} → Mes ${target.number} ${target.label}`);
        if (apply) await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, target.id);
      }
    }
    if (moves.length) { console.log(`${c.name}:`); moves.forEach((m) => console.log(m)); }
  }
}
main().finally(() => db.$disconnect());
