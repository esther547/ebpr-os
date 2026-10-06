/**
 * Fill the empty numbered rows of a "MES N" block in a client's agenda doc with that period's portal
 * pautas that the doc lacks (docs Esther pre-formats with empty slots, e.g. Dra. Paola).
 *   npx tsx scripts/fill-doc-empty-rows.ts "<client>" "MES 3" [--apply]
 */
import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
import { formatFecha, formatHora } from "../lib/agenda-doc-shared";
import { clientSafeNotes } from "../lib/client-safe-notes";
import { dayKeyInTz } from "../components/runners/miami-time";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const docs = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents"] }) });
const txt = (cell: docs_v1.Schema$TableCell | undefined) => (cell?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join("").trim();
async function main() {
  const [name, mes] = process.argv.slice(2); const apply = process.argv.includes("--apply"); const want = Number(mes.match(/\d+/)![0]);
  const c = await db.client.findFirst({ where: { name: { startsWith: name, mode: "insensitive" } }, select: { id: true, name: true, agendaDocUrl: true } });
  if (!c?.agendaDocUrl) throw new Error("cliente sin doc");
  const docId = c.agendaDocUrl.match(/\/d\/([A-Za-z0-9_-]+)/)![1];
  const period = await db.servicePeriod.findFirst({ where: { clientId: c.id, number: want } });
  if (!period) throw new Error(`sin período ${want}`);
  const pautas = await db.runnerAssignment.findMany({ where: { periodId: period.id, status: { not: "CANCELLED" } }, orderBy: { eventDate: "asc" }, select: { eventName: true, eventDate: true, eventTime: true, venueName: true, venueAddress: true, notes: true } });
  const doc = await docs.documents.get({ documentId: docId });
  const tables = (doc.data.body?.content ?? []).filter((el) => el.table);
  const t = tables.reduce((a, b) => ((b.table!.tableRows?.length ?? 0) > (a.table!.tableRows?.length ?? 0) ? b : a));
  const rows = t.table!.tableRows!;
  let inBlock = false; const existing: string[] = []; const empty: number[] = [];
  rows.forEach((r, i) => {
    const cells = (r.tableCells ?? []).map(txt); const first = cells[0];
    if (/^MES\s*\d+/i.test(first)) { inBlock = Number(first.match(/\d+/)![0]) === want; return; }
    if (!inBlock || !/^\d+$/.test(first)) return;
    if (cells.slice(1).some(Boolean)) existing.push(cells[4]); else empty.push(i);
  });
  const missing = pautas.filter((p) => !existing.some((e) => e.toUpperCase().startsWith(p.eventName.toUpperCase().slice(0, 12))));
  console.log(`${c.name} · MES ${want}: ${existing.length} filas con datos, ${empty.length} vacías, ${missing.length} pautas por agregar: ${missing.map((m) => m.eventName).join(", ") || "—"}`);
  if (!apply || !missing.length) return;
  const reqs: docs_v1.Schema$Request[] = [];
  missing.slice(0, empty.length).forEach((p, k) => {
    const row = rows[empty[k]]; const values = ["", formatFecha(dayKeyInTz(p.eventDate)), formatHora(p.eventTime), [p.venueName, p.venueAddress].filter(Boolean).join("\n"), [p.eventName, clientSafeNotes(p.notes)].filter(Boolean).join("\n"), "Goal"];
    (row.tableCells ?? []).forEach((cell, ci) => { if (ci === 0 || !values[ci]) return; reqs.push({ insertText: { location: { index: cell.content![0].startIndex! }, text: values[ci] } }); });
  });
  reqs.sort((a, b) => (b.insertText!.location!.index! - a.insertText!.location!.index!));
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: reqs } });
  console.log(`✓ ${Math.min(missing.length, empty.length)} fila(s) llenadas`);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
