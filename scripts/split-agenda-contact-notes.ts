/**
 * One-time backfill (Esther, Sept 28 2026): pauta notes that look like contacts / internal
 * chatter (phones, emails, "CONTACTO X…", post-event notes, "No requiere runner") move
 * from the client-visible `notes` to `internalNotes`. Client-facing lines (links,
 * publication descriptions) stay where they are.
 *
 *   npx tsx scripts/split-agenda-contact-notes.ts            # dry run
 *   npx tsx scripts/split-agenda-contact-notes.ts --apply
 */
import { db } from "../lib/db";
import { mergeInternalNotes, splitClientNotes } from "../lib/client-safe-notes";

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await db.runnerAssignment.findMany({
    where: { notes: { not: null } },
    select: { id: true, clientId: true, eventName: true, notes: true, internalNotes: true },
  });
  let moved = 0;
  const perClient = new Map<string, number>();
  for (const r of rows) {
    const split = splitClientNotes(r.notes);
    if (!split.internal) continue;
    moved++;
    perClient.set(r.clientId ?? "(agencia)", (perClient.get(r.clientId ?? "(agencia)") ?? 0) + 1);
    if (!apply) {
      console.log(`- ${r.eventName.slice(0, 40)} | internal: ${split.internal.replace(/\s+/g, " ").slice(0, 80)} | client keeps: ${(split.client ?? "").replace(/\s+/g, " ").slice(0, 50) || "—"}`);
      continue;
    }
    await db.runnerAssignment.update({
      where: { id: r.id },
      data: { notes: split.client, internalNotes: mergeInternalNotes(r.internalNotes, split.internal) },
    });
  }
  const clients = await db.client.findMany({ where: { id: { in: [...perClient.keys()].filter((k) => k !== "(agencia)") } }, select: { id: true, name: true } });
  const name = new Map(clients.map((c) => [c.id, c.name]));
  console.log(`${apply ? "MOVED" : "WOULD MOVE"} ${moved} of ${rows.length} pautas with notes`);
  for (const [k, n] of [...perClient.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${name.get(k) ?? k}: ${n}`);
}
main().finally(() => db.$disconnect());
