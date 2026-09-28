/**
 * Import researched press contacts (JSON from the research agents) into Journalists.
 *   npx tsx scripts/import-press-research.ts <file.json>... [--apply]
 * Entries with an email become journalists tagged "Por verificar" (+ beat + region); entries
 * without an email are listed for the team (forms / Instagram) but not imported.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

type Entry = { outlet: string; name: string | null; role: string | null; email: string | null; contactInfo: string | null; phone: string | null; city: string | null; country: string | null; language: string | null; beat: string | null; sourceUrl: string | null; confidence: string | null; note: string | null };
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const REGION: Record<string, string> = { usa: "USA", "united states": "USA", uk: "UK", "united kingdom": "UK", spain: "Spain", españa: "Spain", mexico: "LATAM", méxico: "LATAM", colombia: "LATAM", argentina: "LATAM", chile: "LATAM", peru: "LATAM", perú: "LATAM", venezuela: "LATAM", "puerto rico": "LATAM", france: "Europe", germany: "Europe", italy: "Europe" };

async function main() {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const apply = process.argv.includes("--apply");
  const entries: Entry[] = files.flatMap((f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch (e) { console.log(`!! could not parse ${f}: ${(e as Error).message}`); return []; } });
  const byEmail = new Map<string, Entry & { email: string }>();
  const noEmail: Entry[] = [];
  for (const e of entries) {
    const email = (e.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { noEmail.push(e); continue; }
    if (!byEmail.has(email)) byEmail.set(email, { ...e, email });
  }
  console.log(`entries ${entries.length} · with email ${byEmail.size} · without email ${noEmail.length}`);
  const outletsWithEmail = new Set([...byEmail.values()].map((e) => e.outlet));
  const onlyForm = noEmail.filter((e) => !outletsWithEmail.has(e.outlet));
  console.log(`outlets covered by email: ${outletsWithEmail.size} · outlets with only a form/handle: ${new Set(onlyForm.map((e) => e.outlet)).size}`);
  for (const e of onlyForm.slice(0, 80)) console.log(`   form/handle → ${e.outlet}: ${e.contactInfo ?? "-"} (${e.role ?? ""})`);
  if (!apply) { console.log("\nDry run. Add --apply to import."); return; }

  const db = new PrismaClient();
  let created = 0, skipped = 0;
  for (const e of byEmail.values()) {
    const exists = await db.journalist.findUnique({ where: { email: e.email }, select: { id: true, tags: true } });
    const region = REGION[(e.country ?? "").toLowerCase()] ?? null;
    const tags = [...new Set([e.beat || "General", region, "Por verificar"].filter(Boolean) as string[])];
    if (exists) {
      const merged = [...new Set([...exists.tags, ...tags.filter((t) => t !== "Por verificar")])];
      if (merged.length !== exists.tags.length) await db.journalist.update({ where: { id: exists.id }, data: { tags: merged } });
      skipped++;
      continue;
    }
    const notes = [e.role, e.note, e.confidence ? `Confianza: ${e.confidence}` : null, e.sourceUrl ? `Fuente: ${e.sourceUrl}` : null, "Verificar antes de enviar"].filter(Boolean).join(" · ").slice(0, 1000);
    await db.journalist.create({
      data: {
        name: (e.name && e.name.toUpperCase() !== "N/A" ? e.name : e.outlet).slice(0, 150),
        email: e.email,
        outlet: e.outlet.slice(0, 150),
        beat: e.beat || "General",
        phone: e.phone || null,
        city: e.city || null,
        country: e.country || null,
        language: e.language || null,
        notes,
        tags,
      },
    });
    created++;
  }
  console.log(`\ncreated ${created} · already existed ${skipped}`);
  await db.$disconnect();
}
main().catch((err) => { console.error(err); process.exit(1); });
