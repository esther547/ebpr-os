/**
 * Add CMN's confirmed OFF THE RECORD guests (Email, Last Name, First Name) to the Music Industry database:
 * new contacts are created (category from the EBPR database when the email is known, otherwise "Otros"),
 * existing ones just gain the tag.   npx tsx scripts/import-otr-confirmed.ts [--apply]
 */
import { google } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const sheets = google.sheets({ version: "v4", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] }) });
const TAG = "Off The Record · confirmado";
const title = (s: string) => s.replace(/(^|\s)[.\-_]+(?=\s|$)/g, " ").trim().replace(/\s+/g, " ").split(" ").map((w) => (w === w.toUpperCase() && w.length > 1 ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(" ");
(async () => {
  const apply = process.argv.includes("--apply");
  const rows = (await sheets.spreadsheets.values.get({ spreadsheetId: "1XlP3QdVXYdHUgZq-Zh64AM-9heAxKYGHTH2D0MY0E8I", range: "'Order Details - Event'!A2:C" })).data.values ?? [];
  const seen = new Set<string>(); let created = 0, tagged = 0, skipped = 0;
  for (const r of rows) {
    const email = String(r[0] ?? "").trim().toLowerCase(); const name = title(`${String(r[2] ?? "")} ${String(r[1] ?? "")}`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) { skipped++; continue; } seen.add(email);
    if (/@ebmanagement\.io$/.test(email)) { skipped++; continue; }
    const ex = await db.outreachContact.findUnique({ where: { email }, select: { id: true, tags: true } });
    if (ex) { tagged++; if (apply && !ex.tags.includes(TAG)) await db.outreachContact.update({ where: { id: ex.id }, data: { tags: [...ex.tags, TAG], isActive: true } }); continue; }
    created++;
    const domain = email.match(/@([a-z0-9-]+)\./)?.[1] ?? ""; const generic = /gmail|hotmail|yahoo|icloud|outlook|me|mac|live|aol/.test(domain);
    if (apply) await db.outreachContact.create({ data: { list: "Music Industry", name: name || email.split("@")[0], email, company: generic ? null : domain.charAt(0).toUpperCase() + domain.slice(1), category: "Otros", tags: [TAG], source: "LIST CMN EVENT · confirmados Off The Record (8 oct 2026)" } });
  }
  console.log(`${rows.length} filas → ${created} contactos nuevos, ${tagged} ya existían (etiquetados), ${skipped} sin email válido / repetidos / equipo${apply ? " · aplicado" : " · dry run"}`);
  await db.$disconnect();
})();
