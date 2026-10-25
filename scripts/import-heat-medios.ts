/**
 * "Listado Medios HEAT AWARDS 2026" (PDF → scratchpad rows.json) → Contactos → Medios (journalists).
 * Dedupe by email (case-insensitive): existing journalists keep their data, gain the tags and any missing field.
 *   DATABASE_URL=… DIRECT_URL=… npx tsx scripts/import-heat-medios.ts rows.json
 */
import { readFileSync } from "node:fs";
import { db } from "../lib/db";

type Row = { country: string | null; outlet: string; name: string; email: string };
const TAGS = ["Premios Heat", "Heat Awards 2026"];
const regionTag = (c: string | null) => (c === "USA" ? ["USA"] : c === "Spain" ? ["Spain", "Europe"] : ["LATAM"]);

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(process.argv[2], "utf8"));
  let created = 0, merged = 0; const mergedNames: string[] = [];
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    const name = r.name.trim() || r.outlet.trim();
    const cur = await db.journalist.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    const tags = [...TAGS, ...regionTag(r.country)];
    if (cur) {
      await db.journalist.update({ where: { id: cur.id }, data: {
        tags: Array.from(new Set([...cur.tags, ...tags])), isActive: true,
        outlet: cur.outlet || r.outlet || null, country: cur.country || r.country, name: cur.name.trim() ? cur.name : name,
        notes: cur.notes?.includes("HEAT") ? cur.notes : [cur.notes, "Listado Medios HEAT Awards 2026"].filter(Boolean).join("\n"),
      } });
      merged++; mergedNames.push(`${name} (${cur.name})`);
    } else {
      await db.journalist.create({ data: { name, email, outlet: r.outlet || null, beat: "General", country: r.country, language: r.country === "USA" ? "Both" : "Spanish", tags, notes: "Listado Medios HEAT Awards 2026" } });
      created++;
    }
  }
  console.log({ rows: rows.length, created, merged });
  for (const m of mergedNames) console.log("  ya estaba:", m);
  console.log("total Medios activos:", await db.journalist.count({ where: { isActive: true } }));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
