/**
 * Load a week's priorities (JSON from the weekly meeting notes) into WeeklyPriority.
 *   npx tsx scripts/import-priorities.ts <json> [--apply]
 * Idempotent per (week, client, title).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { tzMidnight, weekStartKey } from "../components/runners/miami-time";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const file = args.find((a) => a.endsWith(".json"))!;

type Item = { client: string | null; title: string; notes?: string | null; assignee?: string | null };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  const data: { week: string; items: Item[] } = JSON.parse(readFileSync(file, "utf8"));
  const weekOf = tzMidnight(weekStartKey(data.week));
  const clients = await db.client.findMany({ select: { id: true, name: true } });
  const byName = new Map(clients.map((c) => [norm(c.name), c.id]));
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const creator = byEmail.get("esther@ebmanagement.io") ?? byEmail.get("esther@ebpublicrelations.com");
  if (!creator) throw new Error("No Esther user found for createdById");
  const existing = await db.weeklyPriority.findMany({ where: { weekOf }, select: { clientId: true, title: true } });
  const seen = new Set(existing.map((e) => `${e.clientId ?? ""}|${norm(e.title)}`));

  let created = 0, skipped = 0, unknown = 0; const orderBy: Record<string, number> = {};
  console.log(`\n=== PRIORITIES IMPORT ${APPLY ? "(APPLYING)" : "(DRY RUN)"} week of ${weekStartKey(data.week)} ===`);
  for (const it of data.items) {
    const clientId = it.client ? byName.get(norm(it.client)) ?? null : null;
    if (it.client && !clientId) { console.log(`  ?? unknown client: ${it.client}`); unknown++; continue; }
    const key = `${clientId ?? ""}|${norm(it.title)}`;
    if (seen.has(key)) { skipped++; continue; }
    const assigneeId = it.assignee ? byEmail.get(it.assignee.toLowerCase()) ?? null : null;
    const ok = (orderBy[clientId ?? "general"] = (orderBy[clientId ?? "general"] ?? 0) + 1);
    console.log(`  ${(it.client ?? "General").padEnd(36)} ${it.title.slice(0, 70)}${assigneeId ? "  → " + it.assignee : ""}`);
    if (APPLY) {
      await db.weeklyPriority.create({ data: { weekOf, clientId, title: it.title.slice(0, 200), notes: it.notes ?? null, assigneeId, order: ok, createdById: creator } });
    }
    created++;
  }
  console.log(`\ncreated ${created}, skipped ${skipped}, unknown ${unknown}. ${APPLY ? "Applied." : "Dry run."}\n`);
}
main().finally(() => db.$disconnect());
