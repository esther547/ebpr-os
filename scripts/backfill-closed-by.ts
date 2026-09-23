/**
 * Backfill "who closed the goal" for goals completed before closedById existed:
 * sets closedById = assigneeId on COMPLETED deliverables that have an assignee and no closer.
 * Only assignees with a strategist role (SUPER_ADMIN / STRATEGIST) are credited; any other
 * assignee is listed and skipped (set those by hand from the goal page).
 *
 *   npx tsx scripts/backfill-closed-by.ts           # dry run (default): prints what would change
 *   npx tsx scripts/backfill-closed-by.ts --apply   # writes
 *
 * Uses DATABASE_URL from .env. Check which database it points to before running --apply.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CLOSER_ROLES = new Set(["SUPER_ADMIN", "STRATEGIST"]);

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/\?.*$/, "");
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — database: ${host || "(unknown)"}\n`);

  const candidates = await db.deliverable.findMany({
    where: { status: "COMPLETED", closedById: null, assigneeId: { not: null } },
    select: {
      id: true,
      title: true,
      completedAt: true,
      client: { select: { name: true } },
      assignee: { select: { id: true, name: true, role: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  const toSet = candidates.filter((d) => d.assignee && CLOSER_ROLES.has(d.assignee.role));
  const skipped = candidates.filter((d) => !d.assignee || !CLOSER_ROLES.has(d.assignee.role));
  const noAssignee = await db.deliverable.count({
    where: { status: "COMPLETED", closedById: null, assigneeId: null },
  });

  for (const d of toSet) {
    const date = d.completedAt ? d.completedAt.toISOString().slice(0, 10) : "sin fecha";
    console.log(`  set  ${date}  ${d.client.name} — "${d.title}"  ->  ${d.assignee!.name}`);
  }
  for (const d of skipped) {
    console.log(`  skip ${d.client.name} — "${d.title}"  (assignee ${d.assignee?.name ?? "?"} is ${d.assignee?.role ?? "missing"})`);
  }

  // Per-strategist summary
  const perName = new Map<string, number>();
  for (const d of toSet) perName.set(d.assignee!.name, (perName.get(d.assignee!.name) ?? 0) + 1);
  console.log("\nSummary");
  for (const [name, n] of Array.from(perName.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${n}`);
  }
  console.log(`  to set: ${toSet.length} · skipped (non-strategist assignee): ${skipped.length} · completed with no assignee (left as "Sin estratega"): ${noAssignee}`);

  if (!APPLY) {
    console.log("\nDry run: nothing written. Re-run with --apply to write.");
    return;
  }

  let updated = 0;
  for (const d of toSet) {
    // Guard against a closer being set between the read and the write.
    const res = await db.deliverable.updateMany({
      where: { id: d.id, closedById: null, status: "COMPLETED" },
      data: { closedById: d.assignee!.id },
    });
    updated += res.count;
  }
  console.log(`\nUpdated ${updated} goal(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
