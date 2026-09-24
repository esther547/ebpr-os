/**
 * Create the linked goal for agenda items the team added by hand (not the doc import,
 * whose ids start with agimp_) that have no deliverable yet. Creator = the user who logged
 * "agenda_item_created" for that client around the same minute, else the assignee/none.
 *   npx tsx scripts/backfill-agenda-goals.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { ensureGoalForAgendaItem } from "../lib/agenda-goal";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const items = await db.runnerAssignment.findMany({
    where: { deliverableId: null, status: { not: "CANCELLED" }, NOT: { id: { startsWith: "agimp_" } }, clientId: { not: null } },
    select: { id: true, clientId: true, eventName: true, eventDate: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n=== AGENDA → GOALS BACKFILL ${APPLY ? "(APPLYING)" : "(DRY RUN)"} — ${items.length} items ===`);
  const names = new Map((await db.client.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  for (const it of items) {
    const log = await db.activityLog.findFirst({
      where: { clientId: it.clientId, action: "agenda_item_created", createdAt: { gte: new Date(it.createdAt.getTime() - 120_000), lte: new Date(it.createdAt.getTime() + 120_000) } },
      select: { user: { select: { id: true, name: true, role: true } } },
    });
    const creator = log?.user ?? null;
    console.log(`  ${(names.get(it.clientId ?? '') ?? '?').padEnd(30)} ${it.eventName.slice(0, 40).padEnd(40)} ${it.eventDate.toISOString().slice(0, 10)}  creator=${creator?.name ?? "—"}`);
    if (APPLY) await ensureGoalForAgendaItem(it.id, creator ? { id: creator.id, role: creator.role } : { id: "", role: "RUNNER" });
  }
  console.log(APPLY ? "\nApplied.\n" : "\nDry run.\n");
}
main().finally(() => db.$disconnect());
