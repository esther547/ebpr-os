/**
 * Append the rows of exports/OFF THE RECORD - contactos EBPR por tab.xlsx to the matching tabs of Esther's
 * OFF THE RECORD Google Sheet (columns A–D only, no contact data), skipping names already in the sheet,
 * and copy the format of the last existing row onto the new rows.
 *   npx tsx scripts/otr-sheet-append.ts [--apply]
 */
import { google, sheets_v4 } from "googleapis";
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const sheets = google.sheets({ version: "v4", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] }) });
const ID = "1w1Z5i4ekP-VLszCWyDGQ_A0adVIL2BZWWihXVOM_KyU";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
(async () => {
  const apply = process.argv.includes("--apply");
  const wb = XLSX.readFile("exports/OFF THE RECORD - contactos EBPR por tab.xlsx");
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const tabs = new Map((meta.data.sheets ?? []).map((s) => [s.properties!.title!, s.properties!]));
  const existing = new Set<string>();
  for (const t of tabs.keys()) { const v = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${t}'!A:A` }); for (const r of v.data.values ?? []) { const n = norm(String(r[0] ?? "")); if (n.length > 2) existing.add(n); } }
  const resumen = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: "'Resumen'!A1:E12", valueRenderOption: "FORMULA" });
  console.log("Resumen (fórmulas):", JSON.stringify((resumen.data.values ?? []).slice(3)));
  const requests: sheets_v4.Schema$Request[] = []; const summary: string[] = [];
  for (const tab of ["DSPs y Plataformas", "Labels", "Distribuidoras", "Ejecutivos", "Talento"]) {
    const props = tabs.get(tab); if (!props) { console.log(`!! tab no encontrada: ${tab}`); continue; }
    const rows = (XLSX.utils.sheet_to_json(wb.Sheets[tab], { header: 1, defval: "" }) as string[][]).slice(1).map((r) => r.slice(0, 4).map((c) => String(c ?? ""))).filter((r) => r.some(Boolean) && !(r[0] && existing.has(norm(r[0]))));
    const cur = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${tab}'!A1:D` });
    const lastRow = (cur.data.values ?? []).length; // 1-based index of the last filled row
    summary.push(`${tab}: ${rows.length} filas nuevas después de la fila ${lastRow}`);
    if (!apply || !rows.length) continue;
    if (lastRow + rows.length > (props.gridProperties?.rowCount ?? 0)) requests.push({ appendDimension: { sheetId: props.sheetId!, dimension: "ROWS", length: lastRow + rows.length - (props.gridProperties?.rowCount ?? 0) + 5 } });
    await sheets.spreadsheets.values.update({ spreadsheetId: ID, range: `'${tab}'!A${lastRow + 1}:D${lastRow + rows.length}`, valueInputOption: "RAW", requestBody: { values: rows } });
    // same look as the row above: copy its format onto the new rows
    requests.push({ copyPaste: { source: { sheetId: props.sheetId!, startRowIndex: lastRow - 1, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: 4 }, destination: { sheetId: props.sheetId!, startRowIndex: lastRow, endRowIndex: lastRow + rows.length, startColumnIndex: 0, endColumnIndex: 4 }, pasteType: "PASTE_FORMAT" } });
  }
  console.log(summary.join("\n"));
  if (apply && requests.length) { await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests: requests.filter((r) => r.appendDimension) } }).catch(() => null); await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests: requests.filter((r) => r.copyPaste) } }); console.log("✓ filas agregadas y formato copiado"); }
})().catch((e) => { console.error("ERR", e.response?.status, e.message?.slice(0, 300)); process.exit(1); });
