/** Esther's third round (Oct 5, night). All placements "manual". */
import { db } from "../lib/db";
import { assignPeriod, clientUnits, periodBoard, defaultLabel, type PeriodUnit } from "../lib/service-periods";
const APPLY = process.argv.includes("--apply");
const log = (s: string) => console.log(s);
async function client(name: string) { const c = await db.client.findFirst({ where: { name: { startsWith: name } }, select: { id: true, name: true, monthlyTarget: true } }); if (!c) throw new Error(name); return c; }
const periods = (clientId: string) => db.servicePeriod.findMany({ where: { clientId }, orderBy: { number: "asc" } });
const by = (units: PeriodUnit[], re: RegExp) => units.filter((u) => re.test(u.title));
const byDate = (units: PeriodUnit[]) => [...units].sort((a, b) => (a.eventDate ?? a.closedAt ?? new Date(0)).getTime() - (b.eventDate ?? b.closedAt ?? new Date(0)).getTime());
async function set(u: PeriodUnit, periodId: string | null, extra: Parameters<typeof assignPeriod>[2] = {}) { if (APPLY) await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, periodId, { source: "manual", ...extra }); }
async function ensure(clientId: string, refMonth: number, target: number) {
  const ex = await db.servicePeriod.findFirst({ where: { clientId, refYear: 2026, refMonth } }); if (ex) return ex;
  if (!APPLY) return { id: `new-${refMonth}`, label: defaultLabel(2026, refMonth), target } as { id: string; label: string; target: number };
  const all = await periods(clientId);
  return db.servicePeriod.create({ data: { clientId, number: Math.max(100, ...all.map((p) => p.number + 1)), label: defaultLabel(2026, refMonth), refYear: 2026, refMonth, target } });
}
async function renumber(clientId: string) {
  if (!APPLY) return;
  const all = [...(await periods(clientId))].sort((a, b) => a.refYear * 12 + a.refMonth - (b.refYear * 12 + b.refMonth));
  for (const [i, p] of all.entries()) await db.servicePeriod.update({ where: { id: p.id }, data: { number: 1000 + i } });
  let n = 1;
  for (const p of all) { const used = (await db.runnerAssignment.count({ where: { periodId: p.id } })) + (await db.deliverable.count({ where: { periodId: p.id } })); if (!used) { await db.servicePeriod.delete({ where: { id: p.id } }); log(`     − período vacío eliminado: ${p.label}`); continue; } await db.servicePeriod.update({ where: { id: p.id }, data: { number: n++ } }); }
}
async function fill(units: PeriodUnit[], months: { id: string; label: string; target: number }[], valueOf: (u: PeriodUnit) => number) {
  let i = 0;
  for (const m of months) { let load = 0; while (i < units.length && load + valueOf(units[i]) <= m.target) { await set(units[i], m.id); load += valueOf(units[i]); i++; } log(`     ${m.label}: ${load}/${m.target}${load < m.target ? ` (faltan ${m.target - load})` : ""}`); }
  return units.slice(i);
}
async function report(c: { id: string; name: string }) { if (!APPLY) return; const b = await periodBoard(c.id); log(`   → ${b.periods.map((p) => `${p.label.split(" ")[0].slice(0, 3)} ${p.achieved}/${p.target}${p.missing ? `(-${p.missing})` : ""}`).join(" · ")}`); }

const ONLY = process.argv.slice(2).filter((x) => !x.startsWith("--"));
async function main() {
  // Mami Lover (Tatiana)
  if (!ONLY.length || ONLY.includes("Tatiana")) { const c = await client("Tatiana"); log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const jlo = by(units, /WORLD PREMIER NETFLIX/i)[0], iga = by(units, /Influencer Global Awards/i)[0], poderosas = by(units, /^People en Español$/i)[0], netflix = by(units, /NETFLIX PREMIERE BERLIN/i)[0];
    const months = []; for (const m of [2, 3, 4, 5, 6, 7, 9]) months.push(await ensure(c.id, m, 6));
    const apr = months.find((m) => m.label.startsWith("Abril"))!;
    await set(netflix, apr.id, { coversPeriod: true, goalValue: 6, periodNote: "La premiere de Netflix vale por las 6 metas de abril (Esther, 5 oct)." });
    // Values and GOLD first (on the current period), then the sequential fill moves everything into place.
    if (APPLY) { await assignPeriod({ pautaId: poderosas.pautaId, goalId: poderosas.goalId }, poderosas.periodId ?? null, { goalValue: 2, periodNote: "People Poderosas vale por 2 metas (Esther, 5 oct)." }); for (const g of [jlo, iga]) await assignPeriod({ pautaId: g.pautaId, goalId: g.goalId }, g.periodId ?? null, { isGold: true }); }
    const value = (u: PeriodUnit) => (u.key === poderosas?.key ? 2 : 1);
    const rest = byDate(units.filter((u) => u.key !== netflix.key));
    const left = await fill(rest, months.filter((m) => m !== apr), value);
    log(`     GOLD: ${jlo?.title}, ${iga?.title} · sobrantes: ${left.length}`); await renumber(c.id); await report(c); }
  // Jonathan: Billboard alfombra = GOLD
  if (!ONLY.length || ONLY.includes("Jonathan Moly")) { const c = await client("Jonathan Moly"); log(`\n${c.name}`);
    const bb = by(await clientUnits(c.id), /Billboard Latin Music Awards/i)[0];
    if (bb && APPLY) await assignPeriod({ pautaId: bb.pautaId, goalId: bb.goalId }, bb.periodId ?? null, { isGold: true });
    log(`     GOLD: ${bb?.title}`); await report(c); }
  // Delfina: Billboard Press Conference → September
  if (!ONLY.length || ONLY.includes("Delfina")) { const c = await client("Delfina"); log(`\n${c.name}`);
    const units = await clientUnits(c.id); const ps = await periods(c.id); const sep = ps.find((p) => p.refMonth === 9)!;
    const pc = by(units, /Press Conference/i)[0]; await set(pc, sep.id); log(`     ${pc?.title} → Septiembre`); await report(c); }
  // Gracie: 99% and Desiguales = 1 each; refill Sept (6) then Oct
  if (!ONLY.length || ONLY.includes("Grace")) { const c = await client("Grace"); log(`\n${c.name}`);
    const units = await clientUnits(c.id); const ps = await periods(c.id); const sep = ps.find((p) => p.refMonth === 9)!, oct = ps.find((p) => p.refMonth === 10)!;
    for (const u of by(units, /99% PODCAST|DESIGUALES TV/i).filter((u) => u.periodId)) if (APPLY) await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, u.periodId, { goalValue: 1 });
    const rest = units.filter((u) => u.periodId && !/NETFLIX PREMIERE BERLIN/i.test(u.title)).sort((a, b) => (a.closedAt ?? a.eventDate ?? new Date(0)).getTime() - (b.closedAt ?? b.eventDate ?? new Date(0)).getTime());
    const left = await fill(rest, [{ id: sep.id, label: sep.label, target: 6 }], (u) => (/99% PODCAST|DESIGUALES TV/i.test(u.title) ? 1 : u.goalValue));
    for (const u of left) await set(u, oct.id); log(`     Octubre: ${left.map((u) => u.title.slice(0, 18)).join(", ")}`); await report(c); }
  // Dani: July = Animals, Paris Hilton, Premios HEAT (2 here); September: Premios HEAT again for 1.
  if (!ONLY.length || ONLY.includes("Daniela Fernandez")) { const c = await client("Daniela Fernandez"); log(`\n${c.name}`);
    const units = await clientUnits(c.id); const ps = await periods(c.id); const jul = ps.find((p) => p.refMonth === 7)!;
    const sep = await ensure(c.id, 9, 4);
    const animals = by(units, /ANIMALS/i)[0], paris = by(units, /PARIS HILTON/i)[0], heat = by(units, /Premios HEAT/i)[0];
    for (const u of [animals, paris]) await set(u, jul.id);
    await set(heat, jul.id, { goalValue: 2, periodNote: "Premios HEAT vale por 3 metas: 2 en julio y 1 en septiembre (Esther, 5 oct)." });
    if (APPLY && !(await db.deliverable.findFirst({ where: { clientId: c.id, title: "Premios HEAT (continuación)" } }))) {
      await db.deliverable.create({ data: { clientId: c.id, title: "Premios HEAT (continuación)", type: "EVENT_APPEARANCE", status: "CONFIRMED", month: 9, year: 2026, goalValue: 1, periodId: sep.id, periodSource: "manual", monthPinned: true, periodNote: "Tercera meta de Premios HEAT, contada en septiembre (Esther, 5 oct)." } });
    }
    // July order: Animals, Paris Hilton, HEAT — keep the dates; the doc lists by date, so give HEAT the day after Paris Hilton
    if (APPLY && heat.goalId) await db.deliverable.update({ where: { id: heat.goalId }, data: { dueDate: new Date("2026-10-16T12:00:00Z") } });
    log(`     Julio: Animals (1), Paris Hilton (1), Premios HEAT (2) · Septiembre: Premios HEAT (1)`); await renumber(c.id); await report(c); }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
