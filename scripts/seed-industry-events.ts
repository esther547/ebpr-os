/**
 * Load the yearly industry events calendar into IndustryEvent.
 *   npx tsx scripts/seed-industry-events.ts [file.json] [--apply]
 * Default file: /private/tmp/claude-501/docs/industry-events.json — an array of
 *   { name, month, day, city, category, notes? }
 * Upserts by name (case-insensitive): new names are created, existing ones get
 * month/day/city/category/notes refreshed. leadDays/url/isActive/year set in
 * the app are left untouched. Dry run unless --apply is passed.
 * Uses DATABASE_URL from the environment (.env locally).
 */
import { PrismaClient, type EventCategory } from "@prisma/client";
import { readFileSync } from "fs";

const DEFAULT_FILE = "/private/tmp/claude-501/docs/industry-events.json";
const CATEGORIES = ["AWARDS", "FASHION", "FILM", "GALA", "SPORTS", "MEDIA", "OTHER"] as const;

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const file = args.find((a) => a.endsWith(".json")) ?? DEFAULT_FILE;

type Row = {
  name: string;
  month: number;
  day?: number | null;
  city?: string | null;
  category?: string | null;
  notes?: string | null;
};

function validate(row: Row, i: number): string | null {
  if (!row.name || typeof row.name !== "string") return `#${i}: missing name`;
  if (!Number.isInteger(row.month) || row.month < 1 || row.month > 12) return `${row.name}: bad month ${row.month}`;
  if (row.day != null && (!Number.isInteger(row.day) || row.day < 1 || row.day > 31)) return `${row.name}: bad day ${row.day}`;
  if (row.category && !CATEGORIES.includes(row.category as (typeof CATEGORIES)[number])) {
    return `${row.name}: bad category ${row.category}`;
  }
  return null;
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) throw new Error("Expected a JSON array");

  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/\?.*$/, "");
  console.log(`\n=== INDUSTRY EVENTS SEED ${APPLY ? "(APPLYING)" : "(DRY RUN)"} → ${host} ===`);
  console.log(`file: ${file} (${rows.length} rows)\n`);

  const problems = rows.map(validate).filter(Boolean);
  if (problems.length) {
    problems.forEach((p) => console.log(`  !! ${p}`));
    throw new Error(`${problems.length} invalid rows — nothing written`);
  }

  const creator = await db.user.findFirst({
    where: { isActive: true, role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  const existing = await db.industryEvent.findMany({ select: { id: true, name: true, month: true, day: true, city: true, category: true, notes: true } });
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));

  let created = 0, updated = 0, unchanged = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) { console.log(`  ~~ duplicate in file, skipped: ${r.name}`); continue; }
    seen.add(key);

    const data = {
      name: r.name.trim(),
      month: r.month,
      day: r.day ?? null,
      city: r.city?.trim() || null,
      category: (r.category ?? "OTHER") as EventCategory,
      notes: r.notes?.trim() || null,
    };
    const when = `${String(data.month).padStart(2, "0")}/${data.day != null ? String(data.day).padStart(2, "0") : "--"}`;
    const current = byName.get(key);

    if (!current) {
      console.log(`  + ${when}  ${data.category.padEnd(8)} ${data.name}${data.city ? " · " + data.city : ""}`);
      if (APPLY) await db.industryEvent.create({ data: { ...data, createdById: creator?.id ?? null } });
      created++;
      continue;
    }
    const same =
      current.month === data.month && current.day === data.day && current.city === data.city &&
      current.category === data.category && current.notes === data.notes;
    if (same) { unchanged++; continue; }
    console.log(`  ~ ${when}  ${data.category.padEnd(8)} ${data.name}`);
    if (APPLY) await db.industryEvent.update({ where: { id: current.id }, data });
    updated++;
  }

  console.log(`\ncreated ${created}, updated ${updated}, unchanged ${unchanged}. ${APPLY ? "Applied." : "Dry run — pass --apply to write."}\n`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
