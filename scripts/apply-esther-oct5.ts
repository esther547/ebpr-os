/**
 * Esther's per-client agenda corrections (Oct 5 2026). Everything placed here is "manual"
 * (the nightly distribution never moves it). Event dates are never touched.
 *   npx tsx scripts/apply-esther-oct5.ts            # plan
 *   npx tsx scripts/apply-esther-oct5.ts --apply
 */
import { db } from "../lib/db";
import { assignPeriod, clientUnits, defaultLabel, periodBoard, type PeriodUnit } from "../lib/service-periods";

const APPLY = process.argv.includes("--apply");
const log = (s: string) => console.log(s);

async function client(name: string) {
  const c = await db.client.findFirst({ where: { name: { startsWith: name } }, select: { id: true, name: true, monthlyTarget: true } });
  if (!c) throw new Error(`cliente no encontrado: ${name}`);
  return c;
}
async function periods(clientId: string) {
  return db.servicePeriod.findMany({ where: { clientId }, orderBy: { number: "asc" } });
}
/** Ledger order: imported history by event date (doc order), then portal-era goals by closing date. */
function ledgerOrder(units: PeriodUnit[]): PeriodUnit[] {
  const hist = units.filter((u) => u.pautaId?.startsWith("agimp_")).sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0));
  const rest = units.filter((u) => !u.pautaId?.startsWith("agimp_")).sort((a, b) => (a.closedAt ?? a.eventDate ?? new Date(0)).getTime() - (b.closedAt ?? b.eventDate ?? new Date(0)).getTime());
  return [...hist, ...rest];
}
async function ensurePeriod(clientId: string, refYear: number, refMonth: number, target: number, number?: number) {
  const existing = await db.servicePeriod.findFirst({ where: { clientId, refYear, refMonth } });
  if (existing) { if (existing.target !== target && APPLY) await db.servicePeriod.update({ where: { id: existing.id }, data: { target } }); return { ...existing, target }; }
  const all = await periods(clientId);
  const n = number ?? Math.max(100, ...all.map((p) => p.number + 1));
  if (!APPLY) return { id: `new-${refYear}-${refMonth}`, clientId, number: n, label: defaultLabel(refYear, refMonth), refYear, refMonth, target, note: null, createdAt: new Date(), updatedAt: new Date() };
  return db.servicePeriod.create({ data: { clientId, number: n, label: defaultLabel(refYear, refMonth), refYear, refMonth, target } });
}
async function place(u: PeriodUnit, periodId: string, extra: { goalValue?: number; coversPeriod?: boolean; periodNote?: string } = {}) {
  if (!APPLY) return;
  await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, periodId, { ...extra, source: "manual" });
}
async function setValue(u: PeriodUnit, value: number, note?: string) {
  if (!APPLY) return;
  await assignPeriod({ pautaId: u.pautaId, goalId: u.goalId }, u.periodId, { goalValue: value, ...(note ? { periodNote: note } : {}) });
}
/** Fill the given months in order with the given units, each month up to its target (by value). Returns leftovers. */
async function fillSequential(units: PeriodUnit[], months: { id: string; label: string; target: number }[], valueOf: (u: PeriodUnit) => number = (u) => u.goalValue) {
  let i = 0;
  for (const m of months) {
    let load = 0;
    while (i < units.length && load + valueOf(units[i]) <= m.target) { await place(units[i], m.id); load += valueOf(units[i]); i++; }
    log(`     ${m.label}: ${load}/${m.target}${load < m.target ? ` (faltan ${m.target - load})` : ""}`);
  }
  return units.slice(i);
}
async function dropEmptyAndRenumber(clientId: string, keepEmpty = false) {
  // Numbering follows the reference month (two passes so the unique (clientId, number) never clashes).
  const all = [...(await periods(clientId))].sort((a, b) => a.refYear * 12 + a.refMonth - (b.refYear * 12 + b.refMonth));
  if (APPLY) for (const [i, p] of all.entries()) await db.servicePeriod.update({ where: { id: p.id }, data: { number: 1000 + i } });
  let n = 1;
  for (const p of all) {
    const used = (await db.runnerAssignment.count({ where: { periodId: p.id } })) + (await db.deliverable.count({ where: { periodId: p.id } }));
    if (!used && !keepEmpty && APPLY) { log(`     − período vacío eliminado: ${p.label}`); if (APPLY) await db.servicePeriod.delete({ where: { id: p.id } }); continue; }
    if (APPLY) await db.servicePeriod.update({ where: { id: p.id }, data: { number: n } });
    n++;
  }
}
async function report(clientId: string) {
  const b = await periodBoard(clientId);
  log(`   → ${b.periods.map((p) => `${p.label.split(" ")[0]} ${p.achieved}/${p.target}`).join(" · ")}${b.pending.length ? ` · pendientes ${b.pending.length}` : ""}`);
}
const byTitle = (units: PeriodUnit[], re: RegExp) => units.filter((u) => re.test(u.title));
const assigned = (units: PeriodUnit[]) => units.filter((u) => u.periodId);

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const skip = (name: string) => ONLY.length > 0 && !ONLY.some((o) => name.toLowerCase().startsWith(o.toLowerCase()));
async function main() {
  // 2. Poli: Aug 6, Sept 6, the rest Oct.
  b: {
    const c = await client("Poli"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = ledgerOrder(await clientUnits(c.id));
    const ps = await periods(c.id);
    const aug = ps.find((p) => p.refMonth === 8)!, sep = ps.find((p) => p.refMonth === 9)!, oct = ps.find((p) => p.refMonth === 10)!;
    const left = await fillSequential(units, [aug, sep].map((p) => ({ id: p.id, label: p.label, target: 6 })));
    for (const u of left) await place(u, oct.id);
    log(`     Octubre: ${left.reduce((s, u) => s + u.goalValue, 0)} (${left.map((u) => u.title.slice(0, 18)).join(", ") || "vacío"})`);
    if (APPLY) await report(c.id);
  }
  // 3. Dani Fernández: 4 per month, consecutive from January.
  b: {
    const c = await client("Daniela Fernandez"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = ledgerOrder(await clientUnits(c.id));
    const months = []; for (let m = 1; m <= 12 && months.reduce((s, x) => s + x.target, 0) < units.reduce((s, u) => s + u.goalValue, 0); m++) months.push(await ensurePeriod(c.id, 2026, m, 4, m));
    const left = await fillSequential(units, months.map((p) => ({ id: p.id, label: p.label, target: 4 })));
    log(`     sobrantes: ${left.length}`); await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 4. Grace: Netflix = 6 (Mes 1 Mayo); Mes 2 Sept = Greeicy; Mes 3 Oct = the rest.
  b: {
    const c = await client("Grace"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const ps = await periods(c.id);
    const may = ps.find((p) => p.refMonth === 5)!, sep = ps.find((p) => p.refMonth === 9)!, oct = await ensurePeriod(c.id, 2026, 10, 6);
    const netflix = byTitle(units, /NETFLIX PREMIERE BERLIN/i)[0];
    await place(netflix, may.id, { goalValue: 6, coversPeriod: true, periodNote: "Viaje a Netflix en España: cuenta como 6 metas, completa el Mes 1 (acuerdo con el cliente)." });
    const greeicy = byTitle(units, /Greeicy/i)[0];
    await place(greeicy, sep.id);
    const rest = assigned(units).filter((u) => u.key !== netflix.key && u.key !== greeicy.key);
    for (const u of rest) await place(u, oct.id);
    log(`     Mayo: Netflix (6) · Septiembre: Greeicy · Octubre: ${rest.map((u) => u.title.slice(0, 16) + (u.goalValue > 1 ? `×${u.goalValue}` : "")).join(", ")}`);
    if (APPLY) { await db.servicePeriod.update({ where: { id: sep.id }, data: { target: 6 } }); await report(c.id); }
  }
  // 5. Delfina: perfect through June; Jul + Sep + Oct units gathered into September (up to 6).
  b: {
    const c = await client("Delfina"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const ps = await periods(c.id);
    const sep = ps.find((p) => p.refMonth === 9)!;
    const later = ledgerOrder(units.filter((u) => { const p = ps.find((x) => x.id === u.periodId); return p && p.refMonth >= 7; }));
    const left = await fillSequential(later, [{ id: sep.id, label: sep.label, target: 6 }]);
    if (left.length) { const oct = await ensurePeriod(c.id, 2026, 10, 6); for (const u of left) await place(u, oct.id); log(`     Octubre: ${left.length}`); }
    await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 6. Lex Borrero: Jan–Mar as is; then Apr 5, May 5, Aug 5, Sep 5 (sequential, 5 per month).
  b: {
    const c = await client("Lex Borrero"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const ps = await periods(c.id);
    const later = ledgerOrder(units.filter((u) => { const p = ps.find((x) => x.id === u.periodId); return !p || p.refMonth >= 4; }));
    const months = [await ensurePeriod(c.id, 2026, 4, 5), await ensurePeriod(c.id, 2026, 5, 5), await ensurePeriod(c.id, 2026, 8, 5), await ensurePeriod(c.id, 2026, 9, 5)];
    const left = await fillSequential(later, months.map((p) => ({ id: p.id, label: p.label, target: 5 })));
    log(`     sobrantes: ${left.length}`); await dropEmptyAndRenumber(c.id, true); if (APPLY) await report(c.id);
  }
  // 8. Alejandra: June as is; July with Virgin = 2; August 6; Sept/Oct dissolved.
  b: {
    const c = await client("Alejandra"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const virgin = byTitle(units, /virgin/i)[0];
    if (virgin) await setValue(virgin, 2, "Virgin cuenta como 2 metas (Esther, 5 oct)."); else log("     ! no encontré la actividad de Virgin");
    const ps = await periods(c.id);
    const jul = ps.find((p) => p.refMonth === 7)!, aug = await ensurePeriod(c.id, 2026, 8, 6);
    const later = ledgerOrder(units.filter((u) => { const p = ps.find((x) => x.id === u.periodId); return !p || p.refMonth >= 7; }));
    const left = await fillSequential(later, [jul, aug].map((p) => ({ id: p.id, label: p.label, target: 6 })), (u) => (virgin && u.key === virgin.key ? 2 : u.goalValue));
    log(`     sobrantes: ${left.length}`); await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 9. Ana Vélez: Mes 1 April with Netflix = 3; then 6 per month consecutively.
  b: {
    const c = await client("Ana Velez"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const netflix = byTitle(units, /netflix/i)[0];
    if (netflix) await setValue(netflix, 3, "Netflix cuenta como 3 metas (Esther, 5 oct)."); else log("     ! no encontré Netflix");
    const ordered = ledgerOrder(units);
    const first = netflix ? [netflix, ...ordered.filter((u) => u.key !== netflix.key)] : ordered;
    const total = first.reduce((s, u) => s + (netflix && u.key === netflix.key ? 3 : u.goalValue), 0);
    const months = []; for (let m = 4; m <= 12 && months.reduce((s, x) => s + 6, 0) < total; m++) months.push(await ensurePeriod(c.id, 2026, m, 6));
    const left = await fillSequential(first, months.map((p) => ({ id: p.id, label: p.label, target: 6 })), (u) => (netflix && u.key === netflix.key ? 3 : u.goalValue));
    log(`     sobrantes: ${left.length}`); await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 10. Charlie Rincón: 6 per month consecutively from January.
  b: {
    const c = await client("Charlie"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = ledgerOrder(await clientUnits(c.id));
    const total = units.reduce((s, u) => s + u.goalValue, 0);
    const months = []; for (let m = 1; m <= 12 && months.length * 6 < total; m++) months.push(await ensurePeriod(c.id, 2026, m, 6));
    const left = await fillSequential(units, months.map((p) => ({ id: p.id, label: p.label, target: 6 })));
    log(`     sobrantes: ${left.length}`); await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 11. Pao Ruiz: Billboard carpet counts in September.
  b: {
    const c = await client("Pao Ruiz"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const bb = byTitle(units, /billboard/i)[0];
    const sep = await ensurePeriod(c.id, 2026, 9, c.monthlyTarget ?? 4);
    if (bb) { await place(bb, sep.id); log(`     Septiembre: ${bb.title}`); }
    await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 13. Benme Legal (Héctor): October units into September until 8.
  b: {
    const c = await client("Hector"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = await clientUnits(c.id);
    const ps = await periods(c.id);
    const sep = ps.find((p) => p.refMonth === 9)!, oct = ps.find((p) => p.refMonth === 10);
    const inSep = units.filter((u) => u.periodId === sep.id).reduce((s, u) => s + u.goalValue, 0);
    const octUnits = oct ? ledgerOrder(units.filter((u) => u.periodId === oct.id)) : [];
    let load = inSep; const moved: string[] = [];
    for (const u of octUnits) { if (load + u.goalValue > 8) break; await place(u, sep.id); load += u.goalValue; moved.push(u.title.slice(0, 20)); }
    log(`     Septiembre: ${load}/8${load < 8 ? ` (faltan ${8 - load})` : ""} · movidas de octubre: ${moved.join(", ") || "ninguna"}`);
    await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
  // 14. Casa D: 6 per month consecutively from January.
  b: {
    const c = await client("Andres Gonzalez"); if (skip(c.name)) break b; log(`\n${c.name}`);
    const units = ledgerOrder(await clientUnits(c.id));
    const total = units.reduce((s, u) => s + u.goalValue, 0);
    const months = []; for (let m = 1; m <= 12 && months.length * 6 < total; m++) months.push(await ensurePeriod(c.id, 2026, m, 6));
    const left = await fillSequential(units, months.map((p) => ({ id: p.id, label: p.label, target: 6 })));
    log(`     sobrantes: ${left.length}`); await dropEmptyAndRenumber(c.id); if (APPLY) await report(c.id);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());