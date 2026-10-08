/**
 * Fill the "MASTER LIST | CONFIRMADOS" tab of the OFF THE RECORD sheet from CMN's confirmed-orders list
 * (Email, Last Name, First Name). Rows keep the tab's columns (Nombre, Plus one, Cargo, Empresa; no
 * emails — the sheet is shared with the client); cargo/empresa come from the Music Industry database
 * (matched by email) or from the sheet's own invite tabs (matched by name).
 *   npx tsx scripts/otr-master-list.ts [--apply]
 */
import { google } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const sheets = google.sheets({ version: "v4", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] }) });
const SRC = "1XlP3QdVXYdHUgZq-Zh64AM-9heAxKYGHTH2D0MY0E8I", DST = "1w1Z5i4ekP-VLszCWyDGQ_A0adVIL2BZWWihXVOM_KyU", TAB = "MASTER LIST | CONFIRMADOS ";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const title = (s: string) => s.replace(/(^|\s)[.\-_]+(?=\s|$)/g, " ").trim().replace(/\s+/g, " ").split(" ").map((w) => (w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(" ");
(async () => {
  const apply = process.argv.includes("--apply");
  const src = (await sheets.spreadsheets.values.get({ spreadsheetId: SRC, range: "'Order Details - Event'!A2:C" })).data.values ?? [];
  // invite tabs: name → { cargo, empresa }
  const meta = await sheets.spreadsheets.get({ spreadsheetId: DST });
  const byName = new Map<string, { cargo: string; empresa: string }>();
  for (const s of meta.data.sheets ?? []) { const t = s.properties!.title!; if (t === TAB || t === "Resumen") continue; const v = (await sheets.spreadsheets.values.get({ spreadsheetId: DST, range: `'${t}'!A7:D` })).data.values ?? []; for (const r of v) { const n = norm(String(r[0] ?? "")); if (n && !byName.has(n)) byName.set(n, { cargo: String(r[2] ?? ""), empresa: String(r[3] ?? "") }); } }
  const contacts = await db.outreachContact.findMany({ where: { email: { not: null } }, select: { email: true, company: true, role: true } });
  const byEmail = new Map(contacts.map((c) => [c.email!.toLowerCase(), c]));
  const seen = new Set<string>(); const rows: string[][] = []; let fromDb = 0, fromTabs = 0;
  for (const r of src) {
    const email = String(r[0] ?? "").trim().toLowerCase(); const last = String(r[1] ?? "").trim(), first = String(r[2] ?? "").trim();
    if (!email && !first && !last) continue;
    const key = email || norm(`${first} ${last}`); if (seen.has(key)) continue; seen.add(key);
    const name = title(`${first} ${last}`);
    let cargo = "", empresa = "";
    const c = byEmail.get(email); if (c) { cargo = c.role ?? ""; empresa = c.company ?? ""; fromDb++; }
    const t = byName.get(norm(name)) ?? byName.get(norm(`${last} ${first}`)); if (t && (!empresa || !cargo)) { cargo ||= t.cargo; empresa ||= t.empresa; fromTabs++; }
    if (!empresa && /@([a-z0-9-]+)\./.test(email) && !/gmail|hotmail|yahoo|icloud|outlook|me\.com|mac\.com|live\./.test(email)) { const d = email.match(/@([a-z0-9-]+)\./)![1]; empresa = d.charAt(0).toUpperCase() + d.slice(1); }
    rows.push([name, "", cargo && cargo !== "." ? cargo : "", empresa]);
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`${src.length} filas en la lista de CMN → ${rows.length} confirmados únicos (cargo/empresa: ${fromDb} desde la base EBPR, ${fromTabs} desde las pestañas de invitados)`);
  for (const r of rows.slice(0, 10)) console.log("   ", r.join(" | "));
  if (!apply) return;
  const dst = tabs(meta, TAB); const cur = (await sheets.spreadsheets.values.get({ spreadsheetId: DST, range: `'${TAB}'!A1:D` })).data.values ?? [];
  const headerRow = cur.findIndex((r) => r[0] === "Nombre") + 1; const start = Math.max(headerRow, cur.length) + 1;
  await sheets.spreadsheets.values.update({ spreadsheetId: DST, range: `'${TAB}'!A${start}:D${start + rows.length - 1}`, valueInputOption: "RAW", requestBody: { values: rows } });
  const ej = tabs(meta, "Ejecutivos");
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: DST, requestBody: { requests: [{ copyPaste: { source: { sheetId: ej, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 4 }, destination: { sheetId: dst, startRowIndex: start - 1, endRowIndex: start - 1 + rows.length, startColumnIndex: 0, endColumnIndex: 4 }, pasteType: "PASTE_FORMAT" } }] } });
  console.log(`✓ ${rows.length} filas escritas en "${TAB.trim()}" desde la fila ${start}`);
  function tabs(m: typeof meta, name: string) { return m.data.sheets!.find((s) => s.properties!.title === name)!.properties!.sheetId!; }
})().catch((e) => { console.error("ERR", e.response?.status, e.message?.slice(0, 300)); process.exit(1); }).finally(() => db.$disconnect());
