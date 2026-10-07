/**
 * Build Esther's "Music Industry" outreach database from
 *   (a) the OFF THE RECORD outreach grid (text extracted from the PDF with `pdftotext -layout`), and
 *   (b) the non-press sheets of MÚSICA.xlsx in the "EBPR - Bases de Datos" export (DSPs, Ascap/BMI, premios,
 *       booking, productores, publishers, disqueras/management, compositores, talentos, marcas, distribuidoras,
 *       financiamiento, PR, law firms, DJs). The MEDIOS sheets are journalists (already imported) and the
 *       PERRO NEGRO sheet is an event attendee list — both skipped.
 *   npx tsx scripts/import-music-industry.ts [--grid <grid.txt>] [--xlsx <MÚSICA.xlsx>] [--apply]
 */
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { db } from "../lib/db";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
type Row = { name: string; email: string; company: string | null; role: string | null; category: string; phone: string | null; notes: string | null; source: string; tags: string[] };

// ── (a) Off The Record grid ──────────────────────────────────────────────────
const GRID_CATEGORY: [RegExp, string][] = [
  [/managm?ent|manager/i, "Management"],
  [/spotify|amazon music|tiktok|apple music|youtube|deezer/i, "DSP"],
  [/\bwme\b|\bcaa\b|\buta\b|booking|the team/i, "Agencias de booking"],
  [/ticket ?master/i, "Ticketing"],
  [/kaseya|coliseo|venue|arena|center$/i, "Venues"],
  [/promoter|presents|producciones|productions|entertainment|touring|events|fest|live\b|promotions|shows|swarm|aeg/i, "Promotores"],
  [/warner|universal|\buml\b|sony|hybe|rimas|records|music\b|distribu/i, "Disqueras"],
  [/\bpr\b|press|publicist|agency|pr agency/i, "PR"],
  [/brown-forman|diageo|bacardi|goya|publix|humana|celsius|cash app|polar|brand|gtb|inpulse|republica|marca/i, "Marcas"],
  [/univision|billboard|hungry post|telemundo|media/i, "Medios"],
  [/influencer|artist|musician|singer|producer/i, "Talento"],
  [/grammy|premios|awards/i, "Premios"],
  [/eb pr/i, "EB PR"],
];
function gridCategory(company: string): string { for (const [re, cat] of GRID_CATEGORY) if (re.test(company)) return cat; return "Otros"; }

function parseGrid(text: string): Row[] {
  const rows: Row[] = []; let pending: { name: string; company: string } | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^\s*(EXAMPLE|F)\s{2,}/, "").trim();
    if (!line || /^NAME\s+COMPANY/i.test(line) || /JD@LAINDUSTRIA/i.test(line)) continue;
    const cols = line.split(/\s{2,}/).map(clean).filter(Boolean);
    const emailIdx = cols.findIndex((c) => EMAIL_RE.test(c));
    if (emailIdx < 0) { pending = { name: cols[0] ?? "", company: cols.slice(1).join(" ") }; continue; }
    const email = cols[emailIdx].match(EMAIL_RE)![0].toLowerCase();
    let name = cols[0], company = cols.slice(1, emailIdx).join(" ");
    if (emailIdx === 0 || (emailIdx === 1 && pending)) { name = pending?.name || name; company = pending?.company || (emailIdx === 1 ? cols[0] : company); }
    pending = null;
    if (/^esther$|@ebmanagement\.io$/i.test(name) || /@ebmanagement\.io$/.test(email)) continue; // the team
    rows.push({ name: name || email.split("@")[0], email, company: company || null, role: null, category: gridCategory(company), phone: null, notes: null, source: "OFF THE RECORD – Outreach Grid (7 oct 2026)", tags: ["Off The Record"] });
  }
  return rows;
}

// ── (b) MÚSICA.xlsx non-press sheets ─────────────────────────────────────────
const SHEETS: Record<string, string> = { DSP: "DSP", "Ascap & BMI": "ASCAP / BMI", PREMIOS: "Premios", "Booking Conciertos ": "Booking", "Music Producers": "Productores", "Music Publisher": "Publishers", "DISQUERAS  MANAGEMENT": "Disqueras / Management", Compositores: "Compositores", TALENTOS: "Talento", "MARCAS MUSICA": "Marcas", Distribuidoras: "Distribuidoras", Financiamiento: "Financiamiento", PR: "PR", "Music Law Firms": "Abogados de música", DJs: "DJs" };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function splitExtra(v: string): { main: string; extra: string } { const m = v.match(/^(.*?)\s*[-–]?\s*\(([^)]*)\)\s*$/); if (m && m[1].trim()) return { main: m[1].replace(/\s*[-–]\s*$/, "").trim(), extra: m[2].trim() }; return { main: v.trim(), extra: "" }; }

function parseSheet(ws: XLSX.WorkSheet, sheet: string, category: string): Row[] {
  const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]).map((r) => r.map(clean));
  let hi = rows.findIndex((r) => r.some((c) => /e-?mail/i.test(c)));
  if (hi < 0) hi = rows.findIndex((r) => r.filter(Boolean).length >= 2);
  const header = rows[hi].map(norm);
  const emailCols = header.map((h, i) => (/e-?mail|contacto$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const nameCol = header.findIndex((h) => /nombre|contact|persona|^name/.test(h) && !/e-?mail/.test(h));
  const companyCol = header.findIndex((h, i) => i !== nameCol && /company|empresa|compositor|talento|^dj|producer|publisher|marca|premios|platform/.test(h));
  const out: Row[] = []; let lastCompany = "";
  for (const r of rows.slice(hi + 1)) {
    if (!r.some(Boolean)) continue;
    const filled = r.filter(Boolean);
    if (filled.length === 1 && !EMAIL_RE.test(filled[0]) && filled[0].length > 1) { lastCompany = filled[0]; continue; } // section header ("ASCAP", "Paramount"…)
    const company = companyCol >= 0 && r[companyCol] ? r[companyCol] : lastCompany; if (companyCol >= 0 && r[companyCol]) lastCompany = r[companyCol];
    // every email-looking cell is a contact; its name/phone/role are the nearest header matches in the same group
    r.forEach((cell, j) => {
      const m = cell.match(EMAIL_RE); if (!m) return;
      const email = m[0].toLowerCase();
      const group = emailCols.length > 1 ? r.slice(Math.max(0, j - 2), j + 2) : r;
      const gh = emailCols.length > 1 ? header.slice(Math.max(0, j - 2), j + 2) : header;
      const pick = (re: RegExp, skip = -1) => { const k = gh.findIndex((h, i) => i !== skip && re.test(h)); return k >= 0 && group[k] && !EMAIL_RE.test(group[k]) ? group[k] : ""; };
      const nk = gh.findIndex((h) => /nombre|contact|persona|^name/.test(h) && !/e-?mail/.test(h));
      let name = nk >= 0 && group[nk] && !EMAIL_RE.test(group[nk]) ? group[nk] : "", role = pick(/role|comentario|description|cargo|extra/, nk), phone = pick(/tel|phone/);
      if (!name && companyCol < 0 && r[0] && !EMAIL_RE.test(r[0])) name = r[0];
      const sx = splitExtra(name); name = sx.main; if (sx.extra && !role) role = sx.extra;
      if (!name || /^[a-z]$/i.test(name)) name = company || email.split("@")[0];
      if (/^(n\/a|-|—)$/i.test(role)) role = "";
      out.push({ name, email, company: company || null, role: role || null, category, phone: phone || null, notes: null, source: `MÚSICA.xlsx · ${sheet.trim()}`, tags: ["Base de datos"] });
    });
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
  const rows: Row[] = [];
  const grid = arg("--grid"); if (grid) { const g = parseGrid(readFileSync(grid, "utf8")); console.log(`grid: ${g.length} contactos`); rows.push(...g); }
  const xlsx = arg("--xlsx");
  if (xlsx) { const wb = XLSX.readFile(xlsx); for (const [sheet, category] of Object.entries(SHEETS)) { const ws = wb.Sheets[sheet]; if (!ws) { console.log(`  !! hoja no encontrada: ${sheet}`); continue; } const s = parseSheet(ws, sheet, category); console.log(`  ${sheet.trim().padEnd(22)} → ${s.length} contactos (${category})`); rows.push(...s); } }
  // dedupe by email: first occurrence wins (grid first), later ones add tags / fill blanks
  const byEmail = new Map<string, Row>();
  for (const r of rows) { const e = byEmail.get(r.email); if (!e) byEmail.set(r.email, r); else { e.tags = [...new Set([...e.tags, ...r.tags])]; e.company ||= r.company; e.role ||= r.role; e.phone ||= r.phone; } }
  const byCat = new Map<string, number>(); for (const r of byEmail.values()) byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
  console.log(`\n${byEmail.size} contactos únicos:`); for (const [c, n] of [...byCat].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${c}`);
  if (process.argv.includes("--samples")) for (const c of byCat.keys()) { console.log(`  [${c}]`); for (const r of [...byEmail.values()].filter((r) => r.category === c).slice(0, 4)) console.log(`     ${r.name} | ${r.company ?? "-"} | ${r.role ?? "-"} | ${r.phone ?? "-"} | ${r.email}`); }
  if (!apply) { console.log("\nDry run. Add --apply to import."); return; }
  let created = 0, updated = 0;
  for (const r of byEmail.values()) {
    const ex = await db.outreachContact.findUnique({ where: { email: r.email }, select: { id: true, tags: true } });
    if (ex) { await db.outreachContact.update({ where: { id: ex.id }, data: { tags: [...new Set([...ex.tags, ...r.tags])], company: r.company ?? undefined, role: r.role ?? undefined, phone: r.phone ?? undefined } }); updated++; }
    else { await db.outreachContact.create({ data: { list: "Music Industry", name: r.name, email: r.email, company: r.company, role: r.role, category: r.category, phone: r.phone, notes: r.notes, source: r.source, tags: r.tags } }); created++; }
  }
  console.log(`creados ${created}, actualizados ${updated}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
