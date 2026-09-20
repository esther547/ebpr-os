/**
 * Apply the "MATRIZ 2026 CLIENTES - SEPTIEMBRE" sheet:
 *   - monthlyTarget per client (bottom of a range, e.g. "6-8" = 6; PREP = 0)
 *   - cycleDay ("fecha de corte")
 *   - completed deliverable count for Sept 2026 (creates placeholder COMPLETED
 *     deliverables only for the difference, so it is safe to re-run)
 *
 *   npx tsx scripts/sync-september-goals.ts          # dry run
 *   npx tsx scripts/sync-september-goals.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const MONTH = 9, YEAR = 2026;

type Row = { name: string; match: string; target: number; cycleDay: number | null; done: number; prep?: boolean };
const ROWS: Row[] = [
  { name: "Casa D",              match: "Andres Gonzalez / Casa D / Rosario", target: 6, cycleDay: 1,  done: 7 },
  { name: "Benme Legal / IT",    match: "Hector Benitez",     target: 8, cycleDay: 25, done: 6 },
  { name: "Karime",              match: "Karime Pindter",     target: 6, cycleDay: 15, done: 0 },
  { name: "Perro Negro",         match: "Perro Negro",        target: 6, cycleDay: 16, done: 0 },
  { name: "Mami Lover",          match: "Tatiana Guiribitey",       target: 6, cycleDay: 1,  done: 1 },
  { name: "Pao Ruiz",            match: "Pao Ruiz",           target: 4, cycleDay: 1,  done: 0 },
  { name: "Marko",               match: "Marko",              target: 8, cycleDay: 19, done: 9 },
  { name: "Charlie Rincón",      match: "Charlie Rincon",     target: 6, cycleDay: 23, done: 0 },
  { name: "Ana Vélez",           match: "Ana Velez",          target: 6, cycleDay: 11, done: 0 },
  { name: "Yeri Mua",            match: "Yeri Mua",           target: 6, cycleDay: 1,  done: 0 },
  { name: "Alejandra Jaramillo", match: "Alejandra Jaramillo",target: 6, cycleDay: 1,  done: 0 },
  { name: "Camila Guribitey",    match: "Camila Guiribitey",  target: 6, cycleDay: 1,  done: 0 },
  { name: "Jonathan Molly",      match: "Jonathan Moly",      target: 6, cycleDay: 17, done: 0 },
  { name: "Rico Rubio",          match: "Rico Rubio",         target: 6, cycleDay: 18, done: 0 },
  { name: "Lex Borrero",         match: "Lex Borrero",        target: 5, cycleDay: 15, done: 0 },
  { name: "Beta Mejía",          match: "Beta Mejia",         target: 6, cycleDay: 1,  done: 0 },
  { name: "Delfina Saud",        match: "Delfina Saud",       target: 6, cycleDay: 1,  done: 4 },
  { name: "Gracie Bon",          match: "Grace Andrea Bonilla",target: 6, cycleDay: 8, done: 3 },
  { name: "Eliane Haro",         match: "Elaine",             target: 0, cycleDay: 14, done: 0, prep: true },
  { name: "Dani Fernández",      match: "Daniela Fernandez",  target: 4, cycleDay: 1,  done: 0 },
  { name: "Alex Ponce",          match: "Alex Ponce",         target: 0, cycleDay: null, done: 0, prep: true },
  { name: "Poli",                match: "Poli",               target: 6, cycleDay: 28, done: 2 },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s: string) => norm(s).replace(/\s+/g, "-");

async function main() {
  const clients = await db.client.findMany({ select: { id: true, name: true, monthlyTarget: true, cycleDay: true, status: true } });
  const byNorm = new Map(clients.map((c) => [norm(c.name), c]));
  const doneCounts = await db.deliverable.groupBy({
    by: ["clientId"], where: { month: MONTH, year: YEAR, status: "COMPLETED" }, _count: { _all: true },
  });
  const doneBy = new Map(doneCounts.map((d) => [d.clientId, d._count._all]));

  console.log(`\n=== SEPTEMBER ${YEAR} GOALS ${APPLY ? "(APPLYING)" : "(DRY RUN)"} ===\n`);
  const plan: { row: Row; client?: (typeof clients)[number]; addDone: number }[] = [];
  for (const row of ROWS) {
    const client = byNorm.get(norm(row.match));
    const have = client ? doneBy.get(client.id) ?? 0 : 0;
    const addDone = Math.max(0, row.done - have);
    plan.push({ row, client, addDone });
    const tgt = row.prep ? "PREP" : String(row.target);
    console.log(
      `${row.name.padEnd(22)} -> ${(client?.name ?? "CREATE NEW").padEnd(36)} target ${String(client?.monthlyTarget ?? "-").padStart(2)}→${tgt.padStart(4)}  corte ${String(client?.cycleDay ?? "-").padStart(2)}→${String(row.cycleDay ?? "-").padStart(2)}  done ${have}→${row.done}${addDone ? ` (+${addDone})` : ""}`
    );
  }
  if (!APPLY) { console.log("\nDry run only. Re-run with --apply.\n"); return; }

  await db.$transaction(async (tx) => {
    for (const { row, client, addDone } of plan) {
      let id = client?.id;
      if (!id) {
        let slug = slugify(row.name); let i = 2;
        while (await tx.client.findUnique({ where: { slug } })) slug = `${slugify(row.name)}-${i++}`;
        id = (await tx.client.create({ data: { name: row.name, slug, status: "ACTIVE", monthlyTarget: row.target, cycleDay: row.cycleDay } })).id;
      } else {
        await tx.client.update({ where: { id }, data: { monthlyTarget: row.target, cycleDay: row.cycleDay, status: "ACTIVE" } });
      }
      const have = (client && doneBy.get(client.id)) ?? 0;
      for (let n = 1; n <= addDone; n++) {
        await tx.deliverable.create({
          data: {
            clientId: id, title: `Meta de septiembre #${have + n}`, type: "OTHER", status: "COMPLETED",
            month: MONTH, year: YEAR, completedAt: new Date(Date.UTC(YEAR, MONTH - 1, 15, 12)),
            notes: "Importado de la MATRIZ 2026 CLIENTES - SEPTIEMBRE. Edita el título y el tipo.",
          },
        });
      }
    }
  });
  console.log("\nApplied.\n");
}

main().finally(() => db.$disconnect());
