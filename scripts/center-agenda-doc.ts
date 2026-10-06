/** Center every table cell of a client's agenda doc in place (format only, no content change).
 *  npx tsx scripts/center-agenda-doc.ts "<client>" [--apply] */
import { google } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const docs = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents"] }) });
async function main() {
  const apply = process.argv.includes("--apply"); const name = process.argv.slice(2).find((a) => !a.startsWith("--"))!;
  const c = await db.client.findFirst({ where: { name: { startsWith: name, mode: "insensitive" } }, select: { name: true, agendaDocUrl: true } });
  const docId = c?.agendaDocUrl?.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1]; if (!docId) throw new Error(`${name}: sin doc`);
  const doc = await docs.documents.get({ documentId: docId });
  const requests: any[] = []; let cells = 0, offCenter = 0;
  for (const el of doc.data.body?.content ?? []) for (const row of el.table?.tableRows ?? []) for (const cell of row.tableCells ?? []) {
    cells++;
    for (const p of cell.content ?? []) {
      if (!p.paragraph || p.startIndex == null || p.endIndex == null) continue;
      if (p.paragraph.paragraphStyle?.alignment !== "CENTER") offCenter++;
      requests.push({ updateParagraphStyle: { range: { startIndex: p.startIndex, endIndex: p.endIndex }, paragraphStyle: { alignment: "CENTER" }, fields: "alignment" } });
    }
  }
  console.log(`${c!.name}: ${cells} celdas, ${offCenter} párrafos sin centrar${apply ? " → centrando" : ""}`);
  if (apply && requests.length) for (let i = 0; i < requests.length; i += 400) await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: requests.slice(i, i + 400) } });
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
