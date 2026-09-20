/**
 * One-off data fix: date-only fields that were stored as UTC midnight
 * (e.g. 2026-10-15T00:00:00Z) render as the previous day in Miami.
 * This shifts those rows to 12:00 UTC so they display correctly in any US timezone.
 *
 * Safe to run more than once (only rows exactly at 00:00:00 UTC are touched).
 * Run against production ONLY after review:
 *   DATABASE_URL=<neon url> npx tsx scripts/fix-date-only-noon.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const targets: { table: string; columns: string[] }[] = [
  { table: "deliverables", columns: ["dueDate"] },
  { table: "tasks", columns: ["dueDate"] },
  { table: "campaigns", columns: ["startDate", "endDate"] },
  { table: "contracts", columns: ["startDate", "endDate"] },
  { table: "invoices", columns: ["issuedAt", "dueDate", "sentAt"] },
  { table: "strategy_items", columns: ["targetDate", "scheduledDate"] },
  { table: "strategy_documents", columns: ["prepMonthStart", "prepMonthEnd", "campaignStart", "phase1Start", "phase1End", "phase2Start", "phase2End"] },
  { table: "onboardings", columns: ["kickoffDate"] },
];

async function main() {
  for (const t of targets) {
    for (const col of t.columns) {
      const res = await db.$executeRawUnsafe(
        `UPDATE "${t.table}" SET "${col}" = "${col}" + interval '12 hours'
         WHERE "${col}" IS NOT NULL AND "${col}"::time = '00:00:00'`
      );
      console.log(`${t.table}.${col}: ${res} rows shifted`);
    }
  }
}

main().finally(() => db.$disconnect());
