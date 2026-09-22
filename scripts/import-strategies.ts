/**
 * Load structured strategy context (from /private/tmp/claude-501/docs/strategy-summaries.json,
 * produced from each client's strategy Google Doc) into StrategyDocument + StrategyItems.
 * Idempotent: the document is upserted; items are skipped when the same title already exists
 * for the client in the same category.
 *
 *   npx tsx scripts/import-strategies.ts [json] [--apply]
 */
import { PrismaClient, StrategyCategory } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const file = args.find((a) => a.endsWith(".json")) ?? "/private/tmp/claude-501/docs/strategy-summaries.json";

type Summary = {
  client: string; objective: string | null; positioning: string | null; keyMessages: string[];
  targetAudience: string | null; focusNow: string | null; mediaTargets: string[]; creatorTargets: string[];
  brandTargets: string[]; eventTargets: { name: string; date: string | null }[]; services: string[];
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  const summaries: Summary[] = JSON.parse(readFileSync(file, "utf8"));
  const clients = await db.client.findMany({ select: { id: true, name: true } });
  const byNorm = new Map(clients.map((c) => [norm(c.name), c]));
  console.log(`\n=== STRATEGY IMPORT ${APPLY ? "(APPLYING)" : "(DRY RUN)"} ===`);

  for (const s of summaries) {
    const client = byNorm.get(norm(s.client));
    if (!client) { console.log(`  ?? no client for "${s.client}"`); continue; }
    const items: { category: StrategyCategory; title: string; notes?: string | null }[] = [
      ...(s.mediaTargets ?? []).map((t) => ({ category: "MEDIA_TARGET" as const, title: t })),
      ...(s.creatorTargets ?? []).map((t) => ({ category: "INFLUENCER" as const, title: t })),
      ...(s.brandTargets ?? []).map((t) => ({ category: "BRAND_OPPORTUNITY" as const, title: t })),
      ...(s.eventTargets ?? []).map((e) => ({ category: "EVENT" as const, title: e.name, notes: e.date ? `Fecha: ${e.date}` : null })),
    ].filter((i) => i.title && i.title.trim().length > 1);

    const existing = await db.strategyItem.findMany({ where: { clientId: client.id }, select: { category: true, title: true } });
    const seen = new Set(existing.map((e) => `${e.category}|${norm(e.title)}`));
    const fresh = items.filter((i) => !seen.has(`${i.category}|${norm(i.title)}`));
    console.log(`  ${client.name.padEnd(36)} doc ${s.objective ? "✓" : "–"}  items new ${fresh.length} / existing ${existing.length}`);
    if (!APPLY) continue;

    await db.strategyDocument.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id, objective: s.objective, clientPersona: s.positioning, keyMessages: s.keyMessages ?? [],
        targetAudience: s.targetAudience, executionNotes: s.focusNow, servicesProvided: s.services ?? [],
      },
      update: {
        objective: s.objective ?? undefined, clientPersona: s.positioning ?? undefined, keyMessages: s.keyMessages ?? undefined,
        targetAudience: s.targetAudience ?? undefined, executionNotes: s.focusNow ?? undefined, servicesProvided: s.services ?? undefined,
      },
    });
    if (fresh.length) {
      await db.strategyItem.createMany({
        data: fresh.map((i, idx) => ({
          clientId: client.id, title: i.title.slice(0, 180), category: i.category, status: "IDEA", priority: 0,
          targetName: i.title.slice(0, 180), notes: i.notes ?? "Importado de la estrategia del cliente",
        })),
      });
    }
  }
  console.log(APPLY ? "\nApplied.\n" : "\nDry run. Re-run with --apply.\n");
}

main().finally(() => db.$disconnect());
