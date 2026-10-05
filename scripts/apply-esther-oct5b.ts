/** Esther's second round (Oct 5): see the message. Everything placed here is "manual". */
import { db } from "../lib/db";
import { assignPeriod, clientUnits, periodBoard, type PeriodUnit } from "../lib/service-periods";
const APPLY = process.argv.includes("--apply");
const log = (s: string) => console.log(s);
async function client(name: string) { const c = await db.client.findFirst({ where: { name: { startsWith: name } }, select: { id: true, name: true, monthlyTarget: true } }); if (!c) throw new Error(name); return c; }
const periods = (clientId: string) => db.servicePeriod.findMany({ where: { clientId }, orderBy: { number: "asc" } });
const by = (units: PeriodUnit[], re: RegExp) => units.filter((u) => re.test(u.title));
async function place(u: PeriodUnit, periodId: string, extra: { goalValue?: number; periodNote?: string } = {}) { if (APPLY) await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, periodId, { ...extra, source: "manual" }); }
async function report(c: { id: string; name: string }) { const b = await periodBoard(c.id); log(`   → ${b.periods.map((p) => `${p.label.split(" ")[0].slice(0, 3)} ${p.achieved}/${p.target}${p.missing ? `(-${p.missing})` : ""}`).join(" · ")}`); }
const order = (units: PeriodUnit[]) => [...units].sort((a, b) => (a.eventDate ?? a.closedAt ?? new Date(0)).getTime() - (b.eventDate ?? b.closedAt ?? new Date(0)).getTime());
async function fill(units: PeriodUnit[], months: { id: string; label: string; target: number }[]) {
  let i = 0;
  for (const m of months) { let load = 0; while (i < units.length && load + units[i].goalValue <= m.target) { await place(units[i], m.id); load += units[i].goalValue; i++; } log(`     ${m.label}: ${load}/${m.target}${load < m.target ? ` (faltan ${m.target - load})` : ""}`); }
  return units.slice(i);
}

const ONLY = new Set(["Alejandra","Daniela Fernandez"]);
async function main() {
  // 2. Benme Legal: The LIBRE Initiative twice in September → keep the one with its pauta.
  if (!ONLY.size || ONLY.has("Hector")) { const c = await client("Hector"); log(`\n${c.name}`);
    const dup = await db.deliverable.findMany({ where: { clientId: c.id, title: { contains: "LIBRE", mode: "insensitive" } }, select: { id: true, closedAt: true }, orderBy: { createdAt: "asc" } });
    const withPauta = new Set((await db.runnerAssignment.findMany({ where: { deliverableId: { in: dup.map((d) => d.id) } }, select: { deliverableId: true } })).map((r) => r.deliverableId));
    const remove = dup.filter((d) => !withPauta.has(d.id)).slice(0, dup.length - 1);
    log(`     duplicados a eliminar: ${remove.length}`);
    if (APPLY) for (const d of remove) { await db.comment.deleteMany({ where: { deliverableId: d.id } }); await db.deliverable.delete({ where: { id: d.id } }); }
    if (APPLY) await report(c); }
  // 8. Jonathan: drop both Karol G activities; Inter Miami = 2 (already); Choque de Gigantes = 2.
  if (!ONLY.size || ONLY.has("Jonathan Moly")) { const c = await client("Jonathan Moly"); log(`\n${c.name}`);
    const karol = await db.runnerAssignment.findMany({ where: { clientId: c.id, eventName: { contains: "KAROL G", mode: "insensitive" } }, select: { id: true, deliverableId: true, eventName: true } });
    log(`     eliminar: ${karol.map((k) => k.eventName).join(", ")}`);
    if (APPLY) for (const k of karol) { await db.runnerAssignment.delete({ where: { id: k.id } }); if (k.deliverableId) { await db.comment.deleteMany({ where: { deliverableId: k.deliverableId } }); await db.deliverable.deleteMany({ where: { id: k.deliverableId } }); } }
    const units = await clientUnits(c.id);
    const choque = by(units, /CHOQUE/i)[0]; if (choque && APPLY) await assignPeriod({ pautaId: choque.pautaId, goalId: choque.goalId }, choque.periodId, { goalValue: 2, periodNote: "Choque de Gigantes vale por 2 metas (Esther, 5 oct)." });
    if (APPLY) await report(c); }
  // 10. Delfina: Venezuela concert = 2 in June; the last June unit moves to September.
  if (!ONLY.size || ONLY.has("Delfina")) { const c = await client("Delfina"); log(`\n${c.name}`);
    const units = await clientUnits(c.id); const ps = await periods(c.id);
    const jun = ps.find((p) => p.refMonth === 6)!, sep = ps.find((p) => p.refMonth === 9)!;
    const vz = by(units, /VENEZUELA/i).find((u) => u.periodId === jun.id);
    if (vz && APPLY) await assignPeriod({ pautaId: vz.pautaId, goalId: vz.goalId }, jun.id, { goalValue: 2, periodNote: "Concierto Unidos por Venezuela vale por 2 metas (Esther, 5 oct)." });
    const juneUnits = order(units.filter((u) => u.periodId === jun.id));
    const last = juneUnits[juneUnits.length - 1]; log(`     ${last.title} → Septiembre`); await place(last, sep.id);
    if (APPLY) await report(c); }
  // 11. Gracie: May = Netflix (6); September = the next six goals; October = the rest.
  if (!ONLY.size || ONLY.has("Grace")) { const c = await client("Grace"); log(`\n${c.name}`);
    const units = await clientUnits(c.id); const ps = await periods(c.id);
    const sep = ps.find((p) => p.refMonth === 9)!, oct = ps.find((p) => p.refMonth === 10)!;
    // Sequence = the order in which they were secured (closing date; event date for the imported history).
    const rest = units.filter((u) => !/NETFLIX PREMIERE BERLIN/i.test(u.title) && u.periodId).sort((a, b) => (a.closedAt ?? a.eventDate ?? new Date(0)).getTime() - (b.closedAt ?? b.eventDate ?? new Date(0)).getTime());
    const left = await fill(rest, [{ id: sep.id, label: sep.label, target: 6 }]);
    for (const u of left) await place(u, oct.id); log(`     Octubre: ${left.map((u) => u.title.slice(0, 18)).join(", ")}`);
    if (APPLY) await report(c); }
  // 6. Alejandra: Virgin = 2 (done) + Marie Claire article = 2 in July, then refill July/August by value.
  { const c = await client("Alejandra"); log(`\n${c.name}`);
    const ps = await periods(c.id); const jul = ps.find((p) => p.refMonth === 7)!, aug = ps.find((p) => p.refMonth === 8)!;
    if (APPLY && !(await db.deliverable.findFirst({ where: { clientId: c.id, title: { contains: "Marie Claire", mode: "insensitive" } } }))) {
      await db.deliverable.create({ data: { clientId: c.id, title: "Artículo en Marie Claire", type: "PRESS_PLACEMENT", status: "CONFIRMED", month: 7, year: 2026, goalValue: 2, periodId: jul.id, periodSource: "manual", monthPinned: true, periodNote: "Agregado por indicación de Esther (5 oct): vale por 2 metas. Fecha por confirmar.", notes: "Fecha de publicación por confirmar." } });
    }
    const units = order(await clientUnits(c.id));
    const later = units.filter((u) => { const p = ps.find((x) => x.id === u.periodId); return !p || p.refMonth >= 7; });
    // Marie Claire right after Virgin in July's order
    const mc = later.find((u) => /Marie Claire/i.test(u.title)); const ordered = mc ? [...later.filter((u) => u !== mc).slice(0, 1), mc, ...later.filter((u) => u !== mc).slice(1)] : later;
    const left = await fill(ordered, [jul, aug].map((p) => ({ id: p.id, label: p.label, target: 6 })));
    log(`     sobrantes: ${left.length}`); if (APPLY) await report(c); }
  // 12. Dani: Premios HEAT = 3 goals; 4 per month, refill from July.
  { const c = await client("Daniela Fernandez"); log(`\n${c.name}`);
    const ps = await periods(c.id); let jul = ps.find((p) => p.refMonth === 7)!;
    if (APPLY && !(await db.deliverable.findFirst({ where: { clientId: c.id, title: { contains: "HEAT", mode: "insensitive" } } }))) {
      await db.deliverable.create({ data: { clientId: c.id, title: "Premios HEAT", type: "EVENT_APPEARANCE", status: "CONFIRMED", month: 7, year: 2026, goalValue: 3, periodId: jul.id, periodSource: "manual", monthPinned: true, periodNote: "Agregado por indicación de Esther (5 oct): vale por 3 metas. Fecha por confirmar." } });
    }
    let aug = ps.find((p) => p.refMonth === 8);
    if (!aug && APPLY) aug = await db.servicePeriod.create({ data: { clientId: c.id, number: (ps[ps.length - 1]?.number ?? 0) + 1, label: "Agosto 2026", refYear: 2026, refMonth: 8, target: 4 } });
    const units = await clientUnits(c.id);
    const later = units.filter((u) => { const p = ps.find((x) => x.id === u.periodId); return !p || p.refMonth >= 7; });
    const heat = later.find((u) => /HEAT/i.test(u.title)); const ordered = heat ? [heat, ...order(later.filter((u) => u !== heat))] : order(later);
    const left = await fill(ordered, [{ id: jul.id, label: jul.label, target: 4 }, ...(aug ? [{ id: aug.id, label: aug.label, target: 4 }] : [])]);
    log(`     sobrantes: ${left.length}`); if (APPLY) await report(c); }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
