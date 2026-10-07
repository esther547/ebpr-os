/**
 * Rows to add to Esther's OFF THE RECORD invitation sheet, one tab per category of the sheet
 * (DSPs y Plataformas, Labels, Distribuidoras, Ejecutivos, Talento), from the Music Industry
 * outreach database. No emails/phones: the sheet is shared with the client.
 *   npx tsx scripts/otr-sheet-rows.ts <exported-sheet.xlsx> <out.xlsx>
 */
import * as XLSX from "xlsx";
import { db } from "../lib/db";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const TAB: Record<string, string> = {
  DSP: "DSPs y Plataformas",
  Disqueras: "Labels", "Disqueras / Management": "Labels", Publishers: "Labels",
  Distribuidoras: "Distribuidoras",
  Talento: "Talento", DJs: "Talento", Compositores: "Talento",
};
const EJECUTIVOS = "Ejecutivos";
const TABS = ["DSPs y Plataformas", "Labels", "Distribuidoras", "Ejecutivos", "Talento"];
(async () => {
  const [inFile, outFile] = process.argv.slice(2);
  const wb = XLSX.readFile(inFile);
  const existing = new Set<string>();
  for (const name of wb.SheetNames) for (const r of XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as string[][]) { const n = norm(String(r[0] ?? "")); if (n && n.length > 2) existing.add(n); }
  console.log(`nombres ya en la hoja: ${existing.size}`);
  const contacts = await db.outreachContact.findMany({ where: { list: "Music Industry", isActive: true }, orderBy: [{ company: "asc" }, { name: "asc" }] });
  const rows: Record<string, string[][]> = Object.fromEntries(TABS.map((t) => [t, []]));
  const seen = new Set<string>(); let skippedExisting = 0, collapsed = 0;
  for (const c of contacts) {
    const cat = c.category ?? "";
    const isPerson = !!c.company && norm(c.name) !== norm(c.company);
    const fromArtistSheet = ["Talento", "DJs", "Compositores", "Disqueras / Management"].includes(cat) && (c.source ?? "").includes("MÚSICA.xlsx");
    let tab = TAB[cat] ?? EJECUTIVOS, nombre = c.name, cargo = c.role?.trim() || "", empresa = c.company ?? "";
    if (fromArtistSheet) {
      // these sheets list an artist/DJ/songwriter ("company") and the person who handles them ("name")
      if (/record|label|disquera|music group/i.test(cargo) || cat === "Disqueras / Management" && isPerson) { tab = /record|label|disquera/i.test(cargo) ? "Labels" : EJECUTIVOS; cargo = `${cargo || "Management"} · ${c.company}`; empresa = c.company ?? ""; }
      else { tab = "Talento"; nombre = c.company ?? c.name; cargo = "Talento"; empresa = "Talento"; }
    } else if (!isPerson && c.company) { nombre = ""; }
    if (!cargo) cargo = tab === "Talento" ? "Talento" : "Cargo por validar";
    if (!empresa) empresa = tab === "Talento" ? "Talento" : "Empresa por validar";
    if (nombre && existing.has(norm(nombre))) { skippedExisting++; continue; }
    const key = `${tab}|${norm(nombre)}|${norm(empresa)}`;
    if (seen.has(key)) { collapsed++; continue; }
    seen.add(key);
    rows[tab].push([nombre, "", cargo, empresa, cat]);
  }
  const out = XLSX.utils.book_new();
  const resumen: (string | number)[][] = [["OFF THE RECORD · contactos de la base EBPR para agregar"], ["Sin emails ni teléfonos (la hoja se comparte con el cliente). Columna E = categoría en la base EBPR, para orientar."], [], ["Tab", "Filas nuevas"]];
  for (const t of TABS) {
    const data = rows[t].sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]));
    const ws = XLSX.utils.aoa_to_sheet([["Nombre", "Plus one", "Cargo / título", "Empresa", "Categoría EBPR"], ...data]);
    ws["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 36 }, { wch: 30 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(out, ws, t);
    resumen.push([t, data.length]);
    console.log(`  ${t.padEnd(20)} ${data.length} filas nuevas`);
  }
  resumen.push(["TOTAL", TABS.reduce((a, t) => a + rows[t].length, 0)]);
  const rs = XLSX.utils.aoa_to_sheet(resumen); rs["!cols"] = [{ wch: 26 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(out, rs, "Resumen");
  out.SheetNames = ["Resumen", ...TABS];
  XLSX.writeFile(out, outFile);
  console.log(`ya estaban en la hoja: ${skippedExisting} · repetidos colapsados: ${collapsed} · archivo: ${outFile}`);
  await db.$disconnect();
})();
