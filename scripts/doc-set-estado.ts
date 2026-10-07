/** Set the ESTADO cell of the rows whose ITEM matches a term. npx tsx scripts/doc-set-estado.ts "<client>" "<term>" "Goal" [--apply] */
import { docs_v1 } from "googleapis";
import { db } from "../lib/db";
import { docsApi, docIdFor } from "./doc-layout";
const txt = (cell?: docs_v1.Schema$TableCell) => (cell?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join("").trim();
async function main() {
  const apply = process.argv.includes("--apply"); const [name, term, value] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const { id, name: client } = await docIdFor(name);
  const doc = (await docsApi.documents.get({ documentId: id })).data;
  const requests: docs_v1.Schema$Request[] = []; let goalStyle: docs_v1.Schema$TextStyle | undefined;
  const rows = (doc.body?.content ?? []).flatMap((el) => el.table?.tableRows ?? []).filter((r) => (r.tableCells?.length ?? 0) >= 6);
  for (const r of rows) { const c = r.tableCells![5]; if (txt(c) === "Goal") { goalStyle = c.content?.[0]?.paragraph?.elements?.[0]?.textRun?.textStyle; break; } }
  for (const r of rows) {
    const cells = r.tableCells!; const item = txt(cells[4]); if (!item.toUpperCase().includes(term.toUpperCase())) continue;
    const est = cells[5]; const cur = txt(est);
    console.log(`${client}: ${txt(cells[1])} | ${item.split("\n")[0].slice(0, 60)} | estado "${cur}" → "${value}"`);
    const paras = (est.content ?? []).filter((c) => c.paragraph); const start = paras[0].startIndex!; const end = paras[paras.length - 1].endIndex! - 1;
    const style = est.content?.[0]?.paragraph?.elements?.[0]?.textRun?.textStyle ?? goalStyle;
    if (end > start) requests.push({ deleteContentRange: { range: { startIndex: start, endIndex: end } } });
    requests.push({ insertText: { location: { index: start }, text: value } });
    if (goalStyle) requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: start + value.length }, textStyle: { bold: goalStyle.bold ?? false, fontSize: goalStyle.fontSize, weightedFontFamily: goalStyle.weightedFontFamily, foregroundColor: goalStyle.foregroundColor }, fields: "bold,fontSize,weightedFontFamily,foregroundColor" } });
    void style;
  }
  if (!requests.length) console.log(`${client}: ninguna fila con "${term}"`);
  // apply bottom-up so earlier indexes stay valid: group per row in reverse order
  if (apply && requests.length) { const groups: docs_v1.Schema$Request[][] = []; for (let i = 0; i < requests.length; ) { const g = [requests[i]]; i++; while (i < requests.length && !requests[i].deleteContentRange && !(requests[i].insertText && g.some((x) => x.insertText))) g.push(requests[i++]); groups.push(g); } groups.reverse(); await docsApi.documents.batchUpdate({ documentId: id, requestBody: { requests: groups.flat() } }); console.log("   ✓ aplicado"); }
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
