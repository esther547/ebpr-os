/**
 * Import media contacts (journalists / outlets) from the agency's "EBPR - Bases de Datos" export.
 *   npx tsx scripts/import-journalists.ts <folder> [--apply]
 * Only MEDIA sheets are read (outlets by region + the "MEDIOS" sheet of each vertical); brands,
 * realtors, attendees, influencers etc. are NOT journalists and stay out of the distribution list.
 * Dedupes by email (merging tags); existing journalists keep their data and gain tags.
 */
import * as XLSX from "xlsx";
import path from "path";
import { PrismaClient } from "@prisma/client";

type Sheet = { file: string; sheet: string; beat: string; tags: string[]; language?: string; country?: string };
const SHEETS: Sheet[] = [
  { file: "MEDIOS - OUTLETS /OUTLETS USA + London (new).xlsx", sheet: "USA", beat: "General", tags: ["USA"], language: "English", country: "USA" },
  { file: "MEDIOS - OUTLETS /OUTLETS USA + London (new).xlsx", sheet: "Londres", beat: "General", tags: ["UK", "Europe"], language: "English", country: "UK" },
  { file: "MEDIOS - OUTLETS /OUTLETS NEW YORK.xlsx", sheet: "NEW YORK", beat: "General", tags: ["USA", "New York"], language: "English", country: "USA" },
  { file: "MEDIOS - OUTLETS /OUTLETS LATAM (new).xlsx", sheet: "LATAM", beat: "General", tags: ["LATAM"], language: "Spanish" },
  { file: "MEDIOS - OUTLETS /OUTLETS EUROPE.xlsx", sheet: "SPAIN", beat: "General", tags: ["Spain", "Europe"], language: "Spanish", country: "Spain" },
  { file: "MEDIOS - OUTLETS /OUTLETS EUROPE.xlsx", sheet: "EMEA", beat: "General", tags: ["Europe"], language: "English" },
  { file: "MEDIOS - OUTLETS /OUTLETS EUROPE.xlsx", sheet: "ASIA", beat: "General", tags: ["Asia"], language: "English" },
  { file: "MEDIOS - OUTLETS /OUTLETS EUROPE.xlsx", sheet: "CROACIA 2", beat: "General", tags: ["Croatia", "Europe"], language: "English", country: "Croatia" },
  { file: "BASES DE DATOS ANTERIORES/INTERNACIONAL/OUTLETS USA.xlsx", sheet: "Hoja 1", beat: "General", tags: ["USA"], language: "English", country: "USA" },
  { file: "BASES DE DATOS ANTERIORES/LATAM/DB MEDIOS/OUTLETS LATAM.xlsx", sheet: "LATAM", beat: "General", tags: ["LATAM"], language: "Spanish" },
  { file: "ABOGADOS/ABOGADOS DE INMIGRACIÓN.xlsx", sheet: "MEDIOS", beat: "Legal", tags: ["Legal"] },
  { file: "BEAUTY/BEAUTY.xlsx", sheet: "MEDIOS", beat: "Beauty", tags: ["Beauty"] },
  { file: "DEPORTES/DEPORTES.xlsx", sheet: "Medios Deportivos", beat: "Sports", tags: ["Sports"] },
  { file: "FASHION/FASHION.xlsx", sheet: "MEDIOS", beat: "Fashion", tags: ["Fashion"] },
  { file: "FASHION/FASHION.xlsx", sheet: "Borrador - EDITORS", beat: "Fashion", tags: ["Fashion", "Editors"] },
  { file: "FINANZAS/FINANZAS.xlsx", sheet: "MEDIOS", beat: "Finance", tags: ["Finance"] },
  { file: "LIBROS/LIBROS.xlsx", sheet: "Medios", beat: "Books", tags: ["Books"] },
  { file: "LIFESTYLE/LIFESTYLE.xlsx", sheet: "MEDIOS", beat: "Lifestyle", tags: ["Lifestyle"] },
  { file: "MÚSICA/MÚSICA.xlsx", sheet: "MEDIOS", beat: "Music", tags: ["Music"] },
  { file: "MÚSICA/MÚSICA.xlsx", sheet: "Medios PREMIOS HEAT", beat: "Music", tags: ["Music", "Premios Heat"] },
  { file: "PODCASTS/PODCASTS.xlsx", sheet: "PODCASTS", beat: "Podcasts", tags: ["Podcasts"] },
  { file: "REAL ESTATE/REAL ESTATE.xlsx", sheet: "MEDIOS", beat: "Real Estate", tags: ["Real Estate"] },
  { file: "REAL ESTATE/INTERIOR DESIGNERS _ ARCHITECTS.xlsx", sheet: "PR  Magazine  TV", beat: "Interior Design", tags: ["Interior Design", "Real Estate"] },
  { file: "RESTAURANTES - LICOR/RESTAURANTES _ ALIMENTOS.xlsx", sheet: "Medios", beat: "Food", tags: ["Food"] },
  { file: "RESTAURANTES - LICOR/RESTAURANTES _ ALIMENTOS.xlsx", sheet: "Food Blogs", beat: "Food", tags: ["Food", "Bloggers"] },
  { file: "WELLNESS/WELLNESS.xlsx", sheet: "MEDIOS", beat: "Wellness", tags: ["Wellness"] },
  { file: "PREMIOS/LATIN GRAMMY_S ESPAÑA/ESPAÑA.xlsx", sheet: "MEDIOS", beat: "General", tags: ["Spain", "Europe"], language: "Spanish", country: "Spain" },
  { file: "TV & Film/TV & Film.xlsx", sheet: "TV Shows", beat: "TV", tags: ["TV"] },
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const isNA = (v: string) => !v || /^(n\/a|na|n\.a\.|-|—|x+)$/i.test(v);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function findCol(header: string[], ...keys: string[]): number {
  for (const k of keys) {
    const i = header.findIndex((h) => norm(h).includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

/** "Destinee Hughes - (Editor-in-Chief)" → name + extra; "106.7 El Zol (Miami)" → outlet + extra. */
function splitExtra(v: string): { main: string; extra: string } {
  const m = v.match(/^(.*?)\s*[-–]?\s*\(([^)]*)\)\s*$/);
  if (m && m[1].trim()) return { main: m[1].replace(/\s*[-–]\s*$/, "").trim(), extra: m[2].trim() };
  return { main: v.trim(), extra: "" };
}

type Contact = { email: string; name: string; outlet: string | null; beat: string; tags: Set<string>; phone: string | null; city: string | null; country: string | null; language: string | null; notes: string[] };

function readSheet(root: string, s: Sheet, out: Map<string, Contact>, stats: Record<string, number>) {
  const wb = XLSX.readFile(path.join(root, s.file));
  const ws = wb.Sheets[s.sheet];
  if (!ws) { console.log(`  !! sheet not found: ${s.file} :: ${s.sheet}`); return; }
  const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]).map((r) => r.map(clean));
  const hi = rows.findIndex((r) => r.some((c) => /^e-?mail/i.test(c) || /email/i.test(c)));
  if (hi < 0) { console.log(`  !! no header with Email: ${s.file} :: ${s.sheet}`); return; }
  const header = rows[hi];
  const cEmail = findCol(header, "email");
  const cName = findCol(header, "contact name", "nombre", "contacto", "contact", "name");
  const cOutlet = findCol(header, "outlet", "canal", "medio", "platform", "podcast", "show", "company");
  const cPhone = findCol(header, "telefono", "teléfono", "phone", "tel");
  const cCity = findCol(header, "city", "ciudad", "location", "based", "direccion", "dirección", "address");
  const cTitle = findCol(header, "contact title", "description", "descripcion", "comentario", "industry", "role");
  const cSubjects = findCol(header, "subjects");
  let n = 0;
  for (const r of rows.slice(hi + 1)) {
    const emails = [...new Set((r[cEmail] ?? "").match(EMAIL_RE) ?? [])].map((e) => e.toLowerCase());
    if (!emails.length) continue;
    const nameRaw = cName >= 0 ? r[cName] : "";
    const outletRaw = cOutlet >= 0 && cOutlet !== cName ? r[cOutlet] : "";
    const nm = splitExtra(isNA(nameRaw) ? "" : nameRaw);
    const ot = splitExtra(isNA(outletRaw) ? "" : outletRaw);
    const phone = cPhone >= 0 && !isNA(r[cPhone]) ? r[cPhone] : null;
    const city = cCity >= 0 && !isNA(r[cCity]) ? r[cCity].slice(0, 120) : null;
    const notes = [nm.extra, cTitle >= 0 ? r[cTitle] : "", cSubjects >= 0 && r[cSubjects] ? `Subjects: ${r[cSubjects]}` : ""].filter((x) => x && !isNA(x));
    for (const email of emails) {
      const existing = out.get(email);
      const name = nm.main || ot.main || email.split("@")[0];
      if (existing) {
        s.tags.forEach((t) => existing.tags.add(t));
        if (existing.beat === "General" && s.beat !== "General") existing.beat = s.beat;
        if (!existing.outlet && ot.main) existing.outlet = ot.main;
        if (!existing.phone && phone) existing.phone = phone;
        for (const x of notes) if (!existing.notes.includes(x)) existing.notes.push(x);
      } else {
        out.set(email, {
          email, name: name.slice(0, 150), outlet: ot.main ? ot.main.slice(0, 150) : null, beat: s.beat, tags: new Set(s.tags),
          phone, city, country: s.country ?? (ot.extra && /^[A-Za-zÀ-ÿ ]{3,30}$/.test(ot.extra) ? ot.extra : null),
          language: s.language ?? null, notes: [...notes, ot.extra && !/^[A-Za-zÀ-ÿ ]{3,30}$/.test(ot.extra) ? ot.extra : ""].filter(Boolean),
        });
      }
      n++;
    }
  }
  stats[`${s.file} :: ${s.sheet}`] = n;
}

async function main() {
  const root = process.argv[2];
  const apply = process.argv.includes("--apply");
  const out = new Map<string, Contact>();
  const stats: Record<string, number> = {};
  for (const s of SHEETS) readSheet(root, s, out, stats);
  for (const [k, v] of Object.entries(stats)) console.log(`  ${String(v).padStart(5)}  ${k}`);
  console.log(`\nunique emails: ${out.size}`);
  const byBeat: Record<string, number> = {};
  for (const c of out.values()) byBeat[c.beat] = (byBeat[c.beat] ?? 0) + 1;
  console.log("by beat:", byBeat);
  console.log("sample:", [...out.values()].slice(0, 3).map((c) => ({ ...c, tags: [...c.tags], notes: c.notes.join(" · ").slice(0, 80) })));
  if (!apply) { console.log("\nDry run. Add --apply to import."); return; }

  const db = new PrismaClient();
  let created = 0, updated = 0;
  const all = [...out.values()];
  for (let i = 0; i < all.length; i += 200) {
    const chunk = all.slice(i, i + 200);
    const existing = await db.journalist.findMany({ where: { email: { in: chunk.map((c) => c.email) } }, select: { id: true, email: true, tags: true } });
    const exMap = new Map(existing.map((e) => [e.email, e]));
    const toCreate = chunk.filter((c) => !exMap.has(c.email));
    if (toCreate.length) {
      await db.journalist.createMany({
        data: toCreate.map((c) => ({ name: c.name, email: c.email, outlet: c.outlet, beat: c.beat, phone: c.phone, city: c.city, country: c.country, language: c.language, notes: c.notes.join(" · ").slice(0, 1000) || null, tags: [...c.tags] })),
        skipDuplicates: true,
      });
      created += toCreate.length;
    }
    for (const c of chunk) {
      const ex = exMap.get(c.email);
      if (!ex) continue;
      const tags = [...new Set([...ex.tags, ...c.tags])];
      if (tags.length !== ex.tags.length) { await db.journalist.update({ where: { id: ex.id }, data: { tags } }); updated++; }
    }
  }
  console.log(`\ncreated ${created}, tags merged on ${updated} existing`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
