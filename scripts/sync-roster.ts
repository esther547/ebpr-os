/**
 * Reconcile the client roster with the list Esther provides.
 *   npx tsx scripts/sync-roster.ts            # dry run: prints the plan only
 *   npx tsx scripts/sync-roster.ts --apply    # applies it
 * Run against production with DATABASE_URL/DIRECT_URL pointed at Neon.
 *
 * Rules: names on the list become ACTIVE (created if missing). Active clients
 * not on the list become PAUSED (never deleted: invoices, contracts, history stay).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Esther's list, Sept 20 2026 (display name as she wrote it, normalized)
const ROSTER = [
  "Benme Legal",
  "Marko",
  "Lele Pons",
  "Perro Negro",
  "Delfina Saud",
  "Casa D",
  "Ana Estela Cisneros (SIMG)",
  "Daniela Fernandez",
  "Camila Guiribitey",
  "Pao Ruiz",
  "Karime Pindter",
  "Lex Borrero",
  "Tatiana Guiribitey",
  "Charlie Rincon",
  "Yeri Mua",
  "Daniella Duran",
  "Ana Velez",
  "Poli",
  "Emile Machado",
  "Henry Arteaga - Corillo LLC",
  "Alejandra Jaramillo",
  "Jonathan Moly",
  "Beta Mejia",
  "Rico Rubio",
  "Doctora Linda Paola Ortiz",
  "Elaine",
  "Gracie Bon",
  "Matt Paris",
  "Alex Ponce",
];

// Map a roster name to the existing client record name when they differ.
const ALIASES: Record<string, string> = {
  "Benme Legal": "Hector Benitez", // hector.benme@gmail.com — CONFIRM WITH ESTHER
  "Casa D": "Andres Gonzalez / Casa D / Rosario",
  "Doctora Linda Paola Ortiz": "Linda Paola Ortiz",
  "Gracie Bon": "Grace Andrea Bonilla", // CONFIRM WITH ESTHER
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (s: string) => norm(s).replace(/\s+/g, "-");

async function main() {
  const clients = await db.client.findMany({ select: { id: true, name: true, status: true, slug: true } });
  const byNorm = new Map(clients.map((c) => [norm(c.name), c]));

  const matched = new Map<string, (typeof clients)[number]>(); // roster name -> client
  const toCreate: string[] = [];

  for (const name of ROSTER) {
    const target = ALIASES[name] ?? name;
    let hit = byNorm.get(norm(target));
    if (!hit) {
      // loose match: existing name contains the roster name or vice versa
      const n = norm(target);
      hit = clients.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)));
    }
    if (hit) matched.set(name, hit);
    else toCreate.push(name);
  }

  const keepIds = new Set([...matched.values()].map((c) => c.id));
  const toPause = clients.filter((c) => c.status === "ACTIVE" && !keepIds.has(c.id));
  const toActivate = [...matched.values()].filter((c) => c.status !== "ACTIVE");

  console.log(`\n=== ROSTER SYNC ${APPLY ? "(APPLYING)" : "(DRY RUN)"} ===`);
  console.log(`\nMatched existing (${matched.size}):`);
  for (const [name, c] of matched) console.log(`  ${name.padEnd(32)} -> ${c.name} [${c.status}]`);
  console.log(`\nWill CREATE as ACTIVE (${toCreate.length}):`);
  for (const n of toCreate) console.log(`  + ${n}`);
  console.log(`\nWill set ACTIVE (${toActivate.length}):`);
  for (const c of toActivate) console.log(`  ^ ${c.name} [${c.status} -> ACTIVE]`);
  console.log(`\nWill set PAUSED (not on list) (${toPause.length}):`);
  for (const c of toPause) console.log(`  - ${c.name}`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write changes.\n");
    return;
  }

  await db.$transaction(async (tx) => {
    for (const c of toActivate) await tx.client.update({ where: { id: c.id }, data: { status: "ACTIVE" } });
    for (const c of toPause) await tx.client.update({ where: { id: c.id }, data: { status: "PAUSED" } });
    for (const name of toCreate) {
      let slug = slugify(name);
      let i = 2;
      while (await tx.client.findUnique({ where: { slug } })) slug = `${slugify(name)}-${i++}`;
      await tx.client.create({ data: { name, slug, status: "ACTIVE", monthlyTarget: 6 } });
    }
  });
  console.log("\nApplied.\n");
}

main().finally(() => db.$disconnect());
