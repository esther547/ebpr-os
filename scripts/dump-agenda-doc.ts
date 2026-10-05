import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const docs = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents.readonly"] }) });
const text = (el: any): string => (el?.paragraph?.elements ?? []).map((e: any) => e.textRun?.content ?? "").join("");
async function main() {
  const res = await docs.documents.get({ documentId: process.argv[2] });
  let cur = "(antes)"; const blocks: Record<string, string[]> = {}; const order: string[] = [];
  for (const el of res.data.body?.content ?? []) {
    if (el.table) for (const row of el.table.tableRows ?? []) {
      const cells = (row.tableCells ?? []).map((c: any) => (c.content ?? []).map(text).join(" ").replace(/\s+/g, " ").trim());
      const joined = cells.join(" | ");
      if (/^MES\s*\d+/i.test(cells[0] ?? "")) { cur = joined.slice(0, 40); order.push(cur); blocks[cur] = []; continue; }
      if (/^#|^N°/i.test(cells[0] ?? "") || (/FECHA/i.test(joined) && /HORA/i.test(joined))) continue;
      if (cells.some((c: string) => c)) (blocks[cur] ??= []).push(joined.slice(0, 90));
    } else if (el.paragraph) { const t = text(el).trim(); if (/^MES\s*\d+/i.test(t)) { cur = t.slice(0, 40); order.push(cur); blocks[cur] = []; } }
  }
  for (const k of order) { console.log(`${k}  → ${blocks[k].length} filas`); if (process.argv[3]) for (const r of blocks[k]) console.log("    " + r); }
}
main();
