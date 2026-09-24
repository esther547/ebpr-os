/**
 * Append ONE row to a month block of an existing Agenda Google Doc, without touching anything else.
 *   npx tsx scripts/append-agenda-row.ts <docId> "<MES label, e.g. MES 3>" "<FECHA>" "<HORA>" "<LUGAR>" "<ITEM>" "<ESTADO>"
 * Works with both layouts: a "MES N" heading paragraph followed by its own table, or one big table
 * where "MES N" is a merged first-column row. The row is inserted after the last row of that block
 * and gets the template's data-row style (lib/agenda-doc-style.ts). A literal "\n" in an argument
 * becomes a line break (e.g. FECHA "Viernes\n01/23/26").
 */
import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
import { baseTextRequests, dataRowCellRequests, fillCellRequests, type CellFill } from "../lib/agenda-doc-style";

const [, , docId, mesLabel, fecha, hora, lugar, item, estado] = process.argv;
if (!docId || !mesLabel || !item) { console.error("usage: append-agenda-row.ts <docId> <MES label> <FECHA> <HORA> <LUGAR> <ITEM> <ESTADO>"); process.exit(1); }

function loadKey() {
  const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!;
  let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim();
  if (/^['"]/.test(raw)) raw = raw.slice(1, -1);
  return JSON.parse(raw);
}
const auth = new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents"] });
const docs = google.docs({ version: "v1", auth });
const txt = (cell: docs_v1.Schema$TableCell | undefined) =>
  (cell?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join("").trim();

async function main() {
  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body?.content ?? [];
  const wantNumber = Number(mesLabel.match(/MES\s*(\d+)/i)?.[1]);
  if (!Number.isFinite(wantNumber)) { console.error(`Etiqueta de mes inválida: "${mesLabel}" (se espera "MES N").`); process.exit(1); }
  // "MES 1" must not match "MES 10": compare the numbers, not prefixes.
  const isWantedMes = (text: string) => Number(text.match(/^MES\s*(\d+)/)?.[1]) === wantNumber;

  // Locate the block: (tableIndex, rowIndex of last row belonging to the MES block)
  let target: { tableStart: number; rowIndex: number; cols: number } | null = null;
  let expectHeadingTable = false;
  for (const el of content) {
    if (el.paragraph) {
      const t = (el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join("").trim().toUpperCase();
      if (isWantedMes(t)) expectHeadingTable = true;
      continue;
    }
    if (!el.table) continue;
    const rows = el.table.tableRows ?? [];
    if (expectHeadingTable) { target = { tableStart: el.startIndex!, rowIndex: rows.length - 1, cols: rows[0]?.tableCells?.length ?? 6 }; break; }
    // single big table with MES rows inside
    let inBlock = false; let last = -1;
    rows.forEach((r, i) => {
      const first = txt(r.tableCells?.[0]).toUpperCase();
      if (/^MES\s*\d+/.test(first)) { inBlock = isWantedMes(first); if (inBlock) last = i; return; }
      if (inBlock) last = i;
    });
    if (last >= 0) { target = { tableStart: el.startIndex!, rowIndex: last, cols: rows[last].tableCells?.length ?? 6 }; break; }
  }
  if (!target) { console.error(`No encontré el bloque "${mesLabel}" en el documento.`); process.exit(2); }

  // 1) insert an empty row below the last row of the block
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ insertTableRow: { tableCellLocation: { tableStartLocation: { index: target.tableStart }, rowIndex: target.rowIndex, columnIndex: 0 }, insertBelow: true } }] },
  });
  // 2) re-read, find that new row's cells, fill them in descending index order
  const after = await docs.documents.get({ documentId: docId });
  const table = (after.data.body?.content ?? []).find((el) => el.table && el.startIndex === target!.tableStart)
    ?? (after.data.body?.content ?? []).filter((el) => el.table).find((el) => (el.startIndex ?? 0) >= target!.tableStart);
  const row = table?.table?.tableRows?.[target.rowIndex + 1];
  if (!row) { console.error("No pude ubicar la fila nueva."); process.exit(3); }
  const prevRow = table?.table?.tableRows?.[target.rowIndex];
  const prevNum = parseInt(txt(prevRow?.tableCells?.[0]), 10);
  const values = [Number.isFinite(prevNum) ? String(prevNum + 1) : "", fecha ?? "", hora ?? "", lugar ?? "", item ?? "", estado ?? "Goal"]
    .map((v) => v.replace(/\\n/g, "\n"));
  const cells = row.tableCells ?? [];
  const rowIndex = target.rowIndex + 1;
  const tableStart = table!.startIndex!;
  // insertTableRow copies the style of the row above (a header row when the block has no pautas yet),
  // so the template's data-row style is always applied explicitly.
  const fills: CellFill[] = cells.map((c, i) => ({
    index: c.content?.[0]?.startIndex ?? 0,
    text: values[i] ?? "",
    bold: i === 0 ? "all" : i === 2 ? (values[2] && values[2] !== "—" ? "all" : "none") : i === 4 ? "firstLine" : "none",
    align: i === 0 ? "START" : "CENTER",
  }));
  const { inserts, styles, inserted } = fillCellRequests(fills);
  const first = fills[0].index;
  const last = fills[fills.length - 1].index;
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        ...inserts,
        ...dataRowCellRequests(tableStart, rowIndex, cells.length),
        ...baseTextRequests(first, last + inserted + 1),
        ...styles,
      ],
    },
  });
  console.log(`Fila agregada en ${mesLabel}: #${values[0]} ${fecha} ${hora} ${lugar} ${item} ${estado}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
