/**
 * Apply verified dates to IndustryEvent rows (matched by exact name).
 * Keeps events recurring (year stays null) but moves month/day to the verified next edition,
 * corrects the city, and prefixes the notes with the verification note.
 *   npx tsx scripts/apply-event-verification.ts <verified.json> [<more.json>...] [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const files = args.filter((a) => a.endsWith(".json"));

type V = { name: string; month: number; day: number | null; year: number | null; city: string; confidence: string; source: string; note: string };

async function main() {
  const rows: V[] = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
  let changed = 0, same = 0, missing = 0;
  console.log(`\n=== EVENT DATE VERIFICATION ${APPLY ? "(APPLYING)" : "(DRY RUN)"} — ${rows.length} events ===`);
  for (const v of rows) {
    const ev = await db.industryEvent.findFirst({ where: { name: v.name } });
    if (!ev) { missing++; console.log(`  ?? not found: ${v.name}`); continue; }
    const m = Number(v.month), d = v.day == null ? null : Number(v.day);
    const validMonth = m >= 1 && m <= 12, validDay = d == null || (d >= 1 && d <= 31);
    if (!validMonth || !validDay || v.confidence === "unknown") { same++; continue; }
    const diff = ev.month !== m || (ev.day ?? null) !== d || (v.city && v.city !== ev.city);
    const tag = v.confidence === "confirmed" ? "✔ Fecha confirmada" : "≈ Fecha estimada";
    const noteLine = `${tag}: ${v.note}${v.source && v.source !== "no source" ? ` (${v.source})` : ""}`;
    const baseNotes = (ev.notes ?? "").replace(/^(✔ Fecha confirmada|≈ Fecha estimada)[^\n]*\n?/, "").trim();
    const notes = [noteLine, baseNotes].filter(Boolean).join("\n").slice(0, 900);
    console.log(`  ${diff ? "~" : "="} ${v.name.slice(0, 44).padEnd(44)} ${ev.month}/${ev.day ?? "-"} -> ${m}/${d ?? "-"}  ${v.confidence}${v.city && v.city !== ev.city ? `  city: ${ev.city} -> ${v.city}` : ""}`);
    if (diff) changed++; else same++;
    if (APPLY) await db.industryEvent.update({ where: { id: ev.id }, data: { month: m, day: d, city: v.city || ev.city, notes } });
  }
  console.log(`\nchanged ${changed}, unchanged ${same}, not found ${missing}. ${APPLY ? "Applied." : "Dry run."}\n`);
}
main().finally(() => db.$disconnect());
