/** Print the page/table layout of a client's agenda doc. npx tsx scripts/doc-layout.ts "<client>" */
import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
export const docsApi = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents"] }) });
const pt = (d?: docs_v1.Schema$Dimension | null) => (d?.magnitude ?? 0).toFixed(0);
const txt = (p: docs_v1.Schema$Paragraph) => (p.elements ?? []).map((e) => e.textRun?.content ?? "").join("").trim();
export async function docIdFor(name: string) { const c = await db.client.findFirst({ where: { name: { startsWith: name, mode: "insensitive" } }, select: { name: true, agendaDocUrl: true } }); const id = c?.agendaDocUrl?.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1]; if (!id) throw new Error(`${name}: sin doc`); return { id, name: c!.name }; }
async function main() {
  const { id, name } = await docIdFor(process.argv[2]);
  const doc = (await docsApi.documents.get({ documentId: id })).data; const ds = doc.documentStyle!;
  const content = (ds.pageSize?.width?.magnitude ?? 0) - (ds.marginLeft?.magnitude ?? 0) - (ds.marginRight?.magnitude ?? 0);
  console.log(`${name}: page ${pt(ds.pageSize?.width)}x${pt(ds.pageSize?.height)} margins L${pt(ds.marginLeft)} R${pt(ds.marginRight)} T${pt(ds.marginTop)} B${pt(ds.marginBottom)} → content width ${content.toFixed(0)}`);
  for (const el of doc.body?.content ?? []) {
    if (el.paragraph) { const t = txt(el.paragraph); if (t) console.log(`  ¶ [${el.paragraph.paragraphStyle?.alignment ?? "START"}] ${el.paragraph.paragraphStyle?.namedStyleType ?? ""} "${t.slice(0, 50)}"`); continue; }
    if (el.table) { const cols = el.table.tableStyle?.tableColumnProperties ?? []; const w = cols.map((c) => c.widthType === "FIXED_WIDTH" ? c.width?.magnitude ?? 0 : null); const sum = w.reduce((a, b) => (a ?? 0) + (b ?? 0), 0 as number | null); const firstCell = el.table.tableRows?.[1]?.tableCells?.[0]; const cs = firstCell?.tableCellStyle; console.log(`  ▦ table ${el.table.rows}x${el.table.columns} widths ${w.map((x) => x == null ? "auto" : x.toFixed(0)).join("/")} sum ${sum?.toFixed(0)} (content ${content.toFixed(0)}) cell pad ${pt(cs?.paddingLeft)}/${pt(cs?.paddingTop)} valign ${cs?.contentAlignment ?? ""}`); const p = firstCell?.content?.[0]?.paragraph; if (p) console.log(`     first data cell: align ${p.paragraphStyle?.alignment} font ${p.elements?.[0]?.textRun?.textStyle?.weightedFontFamily?.fontFamily} ${pt(p.elements?.[0]?.textRun?.textStyle?.fontSize)}pt lineSpacing ${p.paragraphStyle?.lineSpacing} spaceAbove ${pt(p.paragraphStyle?.spaceAbove)} below ${pt(p.paragraphStyle?.spaceBelow)}`); }
  }
}
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
