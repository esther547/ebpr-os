/**
 * Read a client's agenda Google Doc (Esther's ledger) and store, on each matching pauta, the MES
 * block it sits in (agendaMonth/agendaYear) — the month the goal was CLOSED. Linked goals get the
 * same month, so counts agree with the doc. Nothing in the doc is changed.
 *   npx tsx scripts/import-agenda-mes.ts "<client name>"            # dry run
 *   npx tsx scripts/import-agenda-mes.ts "<client name>" --apply
 *   npx tsx scripts/import-agenda-mes.ts --all [--apply]              # every active client with a doc
 */
import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
import { dayKeyInTz } from "../components/runners/miami-time";

const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const docs = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents.readonly"] }) });
const txt = (cell: docs_v1.Schema$TableCell | undefined) => (cell?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join("\n").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const sameName = (a: string, b: string) => { const x = norm(a), y = norm(b); if (!x || !y) return false; const p = Math.min(x.length, y.length, 18); return x.slice(0, p) === y.slice(0, p); };
const dayKeyFromFecha = (text: string): string | null => { const m = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (!m) return null; const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`; };

type DocRow = { mes: number; monthName: string; dayKey: string | null; name: string };
function readDoc(body: docs_v1.Schema$Body | undefined): DocRow[] {
  const out: DocRow[] = []; let cur: { mes: number; monthName: string } | null = null;
  const heading = (t: string) => { const m = t.toUpperCase().match(/^MES\s*(\d+)\s*\(([A-ZÁÉÍÓÚ]+)/); return m ? { mes: Number(m[1]), monthName: m[2].normalize("NFD").replace(/[̀-ͯ]/g, "") } : null; };
  for (const el of body?.content ?? []) {
    if (el.paragraph) { const h = heading((el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join("").trim()); if (h) cur = h; continue; }
    for (const row of el.table?.tableRows ?? []) {
      const cells = row.tableCells ?? []; const first = txt(cells[0]);
      const h = heading(first); if (h) { cur = h; continue; }
      if (!cur || !/^\d+$/.test(first)) continue;
      out.push({ mes: cur.mes, monthName: cur.monthName, dayKey: dayKeyFromFecha(txt(cells[1])), name: txt(cells[4]).split("\n")[0] });
    }
  }
  return out;
}

async function importClient(client: { id: string; name: string; agendaDocUrl: string | null }, apply: boolean) {
  const docId = client.agendaDocUrl?.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
  if (!docId) { console.log(`— ${client.name}: sin doc`); return; }
  const doc = await docs.documents.get({ documentId: docId });
  const rows = readDoc(doc.data.body);
  const pautas = await db.runnerAssignment.findMany({ where: { clientId: client.id }, select: { id: true, eventDate: true, eventName: true, deliverableId: true, agendaMonth: true, agendaYear: true, agendaMonthPinned: true } });
  // Year of a MES block = the year most of its dated rows carry (December → January roll-overs included).
  const yearOf = new Map<number, number>();
  for (const mes of new Set(rows.map((r) => r.mes))) {
    const ys = rows.filter((r) => r.mes === mes && r.dayKey).map((r) => Number(r.dayKey!.slice(0, 4)));
    const best = [...new Set(ys)].sort((a, b) => ys.filter((y) => y === b).length - ys.filter((y) => y === a).length)[0];
    if (best) yearOf.set(mes, best);
  }
  let matched = 0, changed = 0; const unmatched: string[] = [];
  for (const r of rows) {
    const month = MONTHS.indexOf(r.monthName) + 1; const year = yearOf.get(r.mes);
    if (!month || !year) { unmatched.push(`${r.dayKey ?? "?"} ${r.name} (MES ${r.mes} sin mes/año)`); continue; }
    const p = pautas.find((x) => r.dayKey && dayKeyInTz(x.eventDate) === r.dayKey && sameName(x.eventName, r.name));
    if (!p) { unmatched.push(`${r.dayKey ?? "?"} ${r.name}`); continue; }
    matched++;
    if (p.agendaMonth === month && p.agendaYear === year && p.agendaMonthPinned) continue;
    changed++;
    console.log(`  ${r.dayKey} ${r.name.slice(0, 40)} → MES ${r.mes} (${r.monthName} ${year})`);
    if (!apply) continue;
    await db.runnerAssignment.update({ where: { id: p.id }, data: { agendaMonth: month, agendaYear: year, agendaMonthPinned: true } });
    if (p.deliverableId) await db.deliverable.update({ where: { id: p.deliverableId }, data: { month, year, monthPinned: true } }).catch(() => undefined);
  }
  console.log(`${client.name}: ${rows.length} filas en el doc, ${matched} con pauta en el portal, ${changed} ${apply ? "actualizadas" : "por actualizar"}, ${unmatched.length} sin pauta en el portal`);
  for (const u of unmatched.slice(0, 8)) console.log(`    sin pauta: ${u}`);
}

async function main() {
  const apply = process.argv.includes("--apply"); const all = process.argv.includes("--all");
  const name = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const clients = await db.client.findMany({ where: all ? { status: "ACTIVE", agendaDocUrl: { not: null } } : { name: { contains: name ?? "", mode: "insensitive" } }, select: { id: true, name: true, agendaDocUrl: true }, orderBy: { name: "asc" } });
  if (!clients.length) { console.error("Cliente no encontrado"); process.exit(1); }
  for (const c of clients) await importClient(c, apply);
}
main().finally(() => db.$disconnect());
