/**
 * One-time: build each client's service periods from the months the units carry today
 * (agendaMonth/Year on pautas, month/year on goals) and place every unit. Units without a month
 * stay pending review. Nothing is deleted, duplicated or re-dated.
 *   npx tsx scripts/migrate-service-periods.ts            # plan
 *   npx tsx scripts/migrate-service-periods.ts --apply
 */
import { db } from "../lib/db";
import { CLOSED_GOAL_STATUSES } from "../lib/goal-status";
import { defaultLabel } from "../lib/service-periods";

async function main() {
  const apply = process.argv.includes("--apply");
  const clients = await db.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, monthlyTarget: true } });
  for (const c of clients) {
    const existing = await db.servicePeriod.count({ where: { clientId: c.id } });
    if (existing) { console.log(`${c.name}: ya tiene ${existing} períodos, se omite`); continue; }
    const pautas = await db.runnerAssignment.findMany({ where: { clientId: c.id, status: { not: "CANCELLED" } }, select: { id: true, deliverableId: true, agendaYear: true, agendaMonth: true } });
    const goals = await db.deliverable.findMany({ where: { clientId: c.id, status: { in: [...CLOSED_GOAL_STATUSES] }, isInternal: false }, select: { id: true, year: true, month: true } });
    const linked = new Set(pautas.map((p) => p.deliverableId).filter(Boolean) as string[]);
    const months = new Set<string>();
    const place: { pautaId?: string; goalId?: string; key: string | null }[] = [];
    for (const p of pautas) {
      const g = p.deliverableId ? goals.find((x) => x.id === p.deliverableId) : null;
      const y = g?.year ?? p.agendaYear; const m = g?.month ?? p.agendaMonth;
      const key = y && m ? `${y}-${m}` : null; if (key) months.add(key);
      place.push({ pautaId: p.id, goalId: g?.id, key });
    }
    for (const g of goals) { if (linked.has(g.id)) continue; const key = `${g.year}-${g.month}`; months.add(key); place.push({ goalId: g.id, key }); }
    const ordered = [...months].sort((a, b) => { const [ay, am] = a.split("-").map(Number); const [by, bm] = b.split("-").map(Number); return ay * 12 + am - (by * 12 + bm); });
    const pendingCount = place.filter((x) => !x.key).length;
    console.log(`${c.name}: ${ordered.length} períodos (${ordered.map((k, i) => `Mes ${i + 1}=${k}`).join(", ")}) · ${place.length} unidades · ${pendingCount} pendientes`);
    if (!apply || !ordered.length) continue;
    const ids = new Map<string, string>();
    for (const [i, key] of ordered.entries()) {
      const [refYear, refMonth] = key.split("-").map(Number);
      const p = await db.servicePeriod.create({ data: { clientId: c.id, number: i + 1, label: defaultLabel(refYear, refMonth), refYear, refMonth, target: c.monthlyTarget ?? 0 } });
      ids.set(key, p.id);
    }
    for (const x of place) {
      const periodId = x.key ? ids.get(x.key) ?? null : null;
      if (x.pautaId) await db.runnerAssignment.update({ where: { id: x.pautaId }, data: { periodId } });
      if (x.goalId) await db.deliverable.update({ where: { id: x.goalId }, data: { periodId } });
    }
  }
}
main().finally(() => db.$disconnect());
