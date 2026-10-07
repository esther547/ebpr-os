/** Center a client's agenda tables on the page: equal left/right margins sized so the agenda table fills the
 *  content width exactly (the Docs API has no table-alignment setting), and the header table widened to match.
 *  npx tsx scripts/fit-agenda-doc.ts "<client>" [--apply] */
import { docs_v1 } from "googleapis";
import { db } from "../lib/db";
import { docsApi, docIdFor } from "./doc-layout";
async function main() {
  const apply = process.argv.includes("--apply"); const { id, name } = await docIdFor(process.argv.slice(2).find((a) => !a.startsWith("--"))!);
  const doc = (await docsApi.documents.get({ documentId: id })).data; const ds = doc.documentStyle!; const pageW = ds.pageSize!.width!.magnitude!;
  const tables = (doc.body?.content ?? []).filter((el) => el.table).map((el) => ({ start: el.startIndex!, t: el.table! }));
  const width = (t: docs_v1.Schema$Table) => (t.tableStyle?.tableColumnProperties ?? []).reduce((a, c) => a + (c.width?.magnitude ?? 0), 0);
  const main = tables.reduce((a, b) => (width(b.t) > width(a.t) ? b : a)); const target = width(main.t); const margin = Math.round(((pageW - target) / 2) * 10) / 10;
  if (margin < 30) throw new Error(`${name}: tabla demasiado ancha (${target}pt) para centrarla con márgenes ≥ 30pt`);
  const requests: docs_v1.Schema$Request[] = [{ updateDocumentStyle: { documentStyle: { marginLeft: { magnitude: margin, unit: "PT" }, marginRight: { magnitude: margin, unit: "PT" } }, fields: "marginLeft,marginRight" } }];
  const changes: string[] = [`márgenes L/R ${ds.marginLeft?.magnitude}→${margin}pt (tabla ${target}pt en página de ${pageW}pt)`];
  for (const { start, t } of tables) {
    const w = width(t); if (!w || Math.abs(w - target) < 1) continue; const f = target / w; const cols = t.tableStyle!.tableColumnProperties!;
    let acc = 0; cols.forEach((c, i) => { const nw = i === cols.length - 1 ? target - acc : Math.round(c.width!.magnitude! * f); acc += nw; requests.push({ updateTableColumnProperties: { tableStartLocation: { index: start }, columnIndices: [i], tableColumnProperties: { widthType: "FIXED_WIDTH", width: { magnitude: nw, unit: "PT" } }, fields: "width,widthType" } }); });
    changes.push(`tabla ${t.rows}x${t.columns} ${w}→${target}pt`);
  }
  console.log(`${name}: ${changes.join(" · ")}${apply ? " → aplicando" : ""}`);
  if (apply) await docsApi.documents.batchUpdate({ documentId: id, requestBody: { requests } });
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
