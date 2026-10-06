/**
 * Make a client's service periods mirror its Google Doc blocks: one period per "MES N (MONTH)" block
 * (reusing an existing period with the same reference month), every matched pauta placed in its
 * block (manual), a pauta printed k times = value k. Empty periods are removed; numbering follows
 * the doc order.   npx tsx scripts/periods-from-doc.ts "<client>" [--apply]
 */
import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
import { assignPeriod, periodBoard } from "../lib/service-periods";
import { dayKeyInTz } from "../components/runners/miami-time";
const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const docs = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents.readonly"] }) });
const txt = (cell: docs_v1.Schema$TableCell | undefined) => (cell?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join("\n").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const sameName = (a: string, b: string) => { const x = norm(a), y = norm(b); if (!x || !y) return false; const p = Math.min(x.length, y.length, 14); if (x.slice(0, p) === y.slice(0, p)) return true; const fx = x.split(" ").find((w) => w.length >= 4), fy = y.split(" ").find((w) => w.length >= 4); return !!fx && fx === fy; };
const dayKeyFromFecha = (t: string) => { const m = t.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (!m) return null; const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`; };
async function main() {
  const apply = process.argv.includes("--apply"); const name = process.argv.slice(2).find((a) => !a.startsWith("--"))!;
  const c = await db.client.findFirst({ where: { name: { startsWith: name, mode: "insensitive" } }, select: { id: true, name: true, agendaDocUrl: true, monthlyTarget: true } });
  if (!c?.agendaDocUrl) throw new Error("cliente sin doc");
  const doc = await docs.documents.get({ documentId: c.agendaDocUrl.match(/\/d\/([A-Za-z0-9_-]+)/)![1] });
  type Block = { order: number; monthName: string; rows: { dayKey: string | null; name: string }[] };
  const blocks: Block[] = []; let cur: Block | null = null;
  for (const el of doc.data.body?.content ?? []) for (const row of el.table?.tableRows ?? []) {
    const cells = (row.tableCells ?? []).map(txt); const first = cells[0];
    const h = first.toUpperCase().match(/^MES\s*\d+\s*\(([A-ZÁÉÍÓÚ]+)/); if (h) { cur = { order: blocks.length + 1, monthName: h[1].normalize("NFD").replace(/[̀-ͯ]/g, ""), rows: [] }; blocks.push(cur); continue; }
    if (!cur || !/^\d+$/.test(first) || !cells.slice(1).some(Boolean)) continue;
    cur.rows.push({ dayKey: dayKeyFromFecha(cells[1]), name: cells[4].split("\n")[0] });
  }
  const pautas = await db.runnerAssignment.findMany({ where: { clientId: c.id, status: { not: "CANCELLED" } }, select: { id: true, eventDate: true, eventName: true, deliverableId: true } });
  const existing = await db.servicePeriod.findMany({ where: { clientId: c.id } });
  if (apply) for (const p of existing) await db.servicePeriod.update({ where: { id: p.id }, data: { number: 500 + p.number } });
  const placed = new Set<string>();
  for (const b of blocks) {
    const month = MONTHS.indexOf(b.monthName) + 1; if (!month) { console.log(`  ! bloque sin mes reconocido: ${b.monthName}`); continue; }
    const years = b.rows.map((r) => r.dayKey ? Number(r.dayKey.slice(0, 4)) : null).filter((y): y is number => !!y); const year = years.length ? years.sort()[Math.floor(years.length / 2)] : new Date().getFullYear();
    let period = existing.find((p) => p.refYear === year && p.refMonth === month) ?? null;
    if (!period && apply) period = await db.servicePeriod.create({ data: { clientId: c.id, number: 600 + b.order, label: `${b.monthName.charAt(0)}${b.monthName.slice(1).toLowerCase()} ${year}`, refYear: year, refMonth: month, target: c.monthlyTarget ?? 0 } });
    // a pauta printed k times in the block is worth k goals
    const counts = new Map<string, { pauta: (typeof pautas)[number]; k: number }>();
    const unmatched: string[] = [];
    for (const r of b.rows) {
      const sameDay = pautas.filter((x) => r.dayKey && dayKeyInTz(x.eventDate) === r.dayKey);
      const p = sameDay.find((x) => !counts.has(x.id) && norm(x.eventName).startsWith(norm(r.name))) ?? sameDay.find((x) => norm(x.eventName).startsWith(norm(r.name))) ?? sameDay.find((x) => !counts.has(x.id) && sameName(x.eventName, r.name)) ?? sameDay.find((x) => sameName(x.eventName, r.name));
      if (!p) { unmatched.push(`${r.dayKey ?? "?"} ${r.name.slice(0, 30)}`); continue; }
      const e = counts.get(p.id) ?? { pauta: p, k: 0 }; e.k++; counts.set(p.id, e);
    }
    for (const { pauta, k } of counts.values()) { placed.add(pauta.id); if (apply && period) await assignPeriod({ pautaId: pauta.id }, period.id, { source: "manual", goalValue: k }); }
    console.log(`  MES ${b.order} (${b.monthName} ${year}): ${b.rows.length} filas → ${counts.size} pautas${[...counts.values()].some((e) => e.k > 1) ? ` (valen 2+: ${[...counts.values()].filter((e) => e.k > 1).map((e) => `${e.pauta.eventName.slice(0, 18)}×${e.k}`).join(", ")})` : ""}${unmatched.length ? ` · sin pauta en el portal: ${unmatched.join("; ")}` : ""}`);
  }
  if (apply) {
    const all = [...(await db.servicePeriod.findMany({ where: { clientId: c.id } }))].sort((a, b) => a.refYear * 12 + a.refMonth - (b.refYear * 12 + b.refMonth));
    let n = 1;
    for (const p of all) { const used = (await db.runnerAssignment.count({ where: { periodId: p.id } })) + (await db.deliverable.count({ where: { periodId: p.id } })); if (!used) { await db.servicePeriod.delete({ where: { id: p.id } }); continue; } await db.servicePeriod.update({ where: { id: p.id }, data: { number: 900 + n++ } }); }
    for (const p of await db.servicePeriod.findMany({ where: { clientId: c.id } })) await db.servicePeriod.update({ where: { id: p.id }, data: { number: p.number - 900 } });
    const board = await periodBoard(c.id); console.log(`  → ${board.periods.map((p) => `Mes ${p.number} ${p.label.split(" ")[0]} ${p.achieved}/${p.target}`).join(" · ")}${board.pending.length ? ` · sin período: ${board.pending.map((u) => u.title.slice(0, 16)).join(", ")}` : ""}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
