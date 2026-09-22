/**
 * Import client agenda rows (parsed from the clients' Agenda Google Docs into
 * /private/tmp/claude-501/docs/agenda.json) as RunnerAssignment records:
 *   past rows      -> COMPLETED (history on the client agenda)
 *   future rows    -> SCHEDULED with no runner ("needs a runner", auto-assign picks one)
 *   "passed by client" -> CANCELLED, "pending" -> SCHEDULED
 * Idempotent: rows carry a stable id (agimp_<hash>), re-runs skip existing ones.
 *
 *   npx tsx scripts/import-agenda.ts <json> [--from 2026-09-01] [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { tzMidnight, dayKeyInTz, weekStartKey } from "../components/runners/miami-time";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const file = args.find((a) => a.endsWith(".json")) ?? "/private/tmp/claude-501/docs/agenda.json";
const fromIdx = args.indexOf("--from");
const FROM = fromIdx >= 0 ? args[fromIdx + 1] : "2026-09-01";

type Row = { id: string; client: string; date: string; time: string | null; timeRaw: string; venue: string; title: string; notes: string; estado: string };

function itemType(venue: string, title: string): string {
  const t = `${venue} ${title}`.toLowerCase();
  if (/instagram|tiktok|reel|post|publicaci/.test(t)) return "Social";
  if (/zoom|meet|virtual|call|llamada|meeting|reuni/.test(t)) return "Meeting";
  if (/univision|telemundo|tv|television|rcn|cnn|radio|podcast|entrevista|interview/.test(t)) return "TV / Media";
  if (/red carpet|alfombra|gala|premiere|evento|event|festival/.test(t)) return "Event";
  return "Appearance";
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(file, "utf8")).filter((r: Row) => r.date >= FROM);
  const clients = await db.client.findMany({ select: { id: true, name: true } });
  const byName = new Map(clients.map((c) => [c.name, c.id]));
  const existing = new Set((await db.runnerAssignment.findMany({ where: { id: { startsWith: "agimp_" } }, select: { id: true } })).map((a) => a.id));
  const todayKey = dayKeyInTz(new Date());

  let created = 0, skipped = 0, missingClient = 0;
  const summary: Record<string, { past: number; future: number; cancelled: number }> = {};
  const plan: Parameters<typeof db.runnerAssignment.create>[0]["data"][] = [];

  for (const r of rows) {
    const clientId = byName.get(r.client);
    if (!clientId) { missingClient++; continue; }
    if (existing.has(r.id)) { skipped++; continue; }
    existing.add(r.id); // identical rows in the doc share a hash: import once
    const [h, m] = (r.time ?? "12:00").split(":").map(Number);
    const eventDate = new Date(tzMidnight(r.date).getTime() + (h * 60 + m) * 60_000);
    const isFuture = r.date >= todayKey;
    const status = r.estado === "passed by client" ? "CANCELLED" : isFuture || r.estado === "pending" ? "SCHEDULED" : "COMPLETED";
    const s = (summary[r.client] ??= { past: 0, future: 0, cancelled: 0 });
    if (status === "CANCELLED") s.cancelled++; else if (status === "SCHEDULED") s.future++; else s.past++;
    plan.push({
      id: r.id,
      clientId,
      eventDate,
      eventTime: r.time ? eventDate : null,
      eventName: r.title,
      venueName: r.venue || null,
      location: r.venue ? r.venue.split("\n")[0].slice(0, 80) : null,
      notes: [r.notes, r.time ? null : `Hora en el documento: ${r.timeRaw || "sin hora"}`].filter(Boolean).join("\n") || null,
      itemType: itemType(r.venue, r.title),
      status,
      weekOf: tzMidnight(weekStartKey(r.date)),
    });
    created++;
  }

  console.log(`\n=== AGENDA IMPORT ${APPLY ? "(APPLYING)" : "(DRY RUN)"} from ${FROM} ===`);
  for (const [c, s] of Object.entries(summary)) console.log(`  ${c.padEnd(36)} past ${s.past}  future ${s.future}  cancelled ${s.cancelled}`);
  console.log(`\nto create: ${created}, already imported: ${skipped}, unknown client: ${missingClient}`);
  if (!APPLY) { console.log("Dry run. Re-run with --apply.\n"); return; }
  let failed = 0;
  for (const data of plan) {
    try {
      await db.runnerAssignment.create({ data });
    } catch (err) {
      failed++;
      console.log(`  !! ${String((data as { eventName?: string }).eventName).slice(0, 50)}: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`Applied (${failed} failed).\n`);
}

main().finally(() => db.$disconnect());
