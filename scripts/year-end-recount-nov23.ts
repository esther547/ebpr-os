/**
 * Esther's recount of Nov 23 2026 ("CONTEO METAS PENDIENTES CLIENTES"): November and December apart, with the day
 * she bills December where she gave one. Run once with --apply right after deploying the code whose
 * GOAL_CLOSING.since is that moment. Do NOT rerun blindly: it resets the numbers to the listed ones.
 *   npx tsx scripts/year-end-recount-nov23.ts            (dry run)
 *   npx tsx scripts/year-end-recount-nov23.ts --apply
 */
import { db } from "../lib/db";

type Row = { name: string; nov: number; dec: number | null; bill?: string; note?: string | null };
const LIST: Row[] = [
  { name: "Hector Benitez", nov: 2, dec: 8, bill: "2026-11-25" },
  { name: "Marko", nov: 0, dec: 6 },
  { name: "Lele Pons", nov: 0, dec: 1 },
  { name: "Perro Negro", nov: 0, dec: 1 },
  { name: "Guaynaa", nov: 0, dec: 6 },
  { name: "Delfina Saud", nov: 5, dec: null, bill: "2026-12-01" },
  { name: "Daniela Fernandez", nov: 8, dec: null },
  { name: "Camila Guiribitey", nov: 2, dec: null, note: "Si desea continuar debe renovar" },
  { name: "Pao Ruiz", nov: 0, dec: 16 },
  { name: "Karime Pindter", nov: 0, dec: 4 },
  { name: "Lex Borrero", nov: 20, dec: null, bill: "2026-12-10" },
  { name: "Charlie Rincon", nov: 0, dec: 6 },
  { name: "Daniella Duran", nov: 3, dec: null },
  { name: "Poli", nov: 4, dec: null, note: "Antes del 1 de diciembre" },
  { name: "Emile Machado", nov: 6, dec: null, note: "Arrastra desde octubre: cerrar ASAP" },
  { name: "Beta Mejia", nov: 3, dec: null, note: "Atrasadas de septiembre" },
  { name: "Rico Rubio", nov: 0, dec: 3 },
  { name: "Dra. Paola Ortiz", nov: 6, dec: 6, bill: "2026-11-28" },
  { name: "Elaine Haro", nov: 0, dec: 7 },
  { name: "Grace Andrea Bonilla", nov: 5, dec: 6, bill: "2026-12-08" },
  { name: "Alex Ponce", nov: 6, dec: 6, bill: "2026-12-17" },
  { name: "Humberto Marquina", nov: 0, dec: 6 },
  { name: "Michelle Paredes", nov: 0, dec: 6 },
  { name: "Andy Rivera", nov: 0, dec: 6 },
];

/** Pending on Nov 23 under the first count, for the counted clients missing from her list. */
const KEPT: Record<string, number> = { "Andres Gonzalez / Casa D / Rosario": 5, "Tatiana Guiribitey": 6, "Marianela Ancheta": 0 };

(async () => {
  const apply = process.argv.includes("--apply");
  const all = await db.client.findMany({ select: { id: true, name: true, status: true, closingOwed: true, closingOwedDec: true, closingBillKey: true, closingNote: true, closingHold: true } });
  const listed = new Set<string>();
  for (const row of LIST) {
    const c = all.find((x) => x.name === row.name);
    if (!c) { console.log(`!! no existe: ${row.name}`); continue; }
    listed.add(c.id);
    console.log(`${row.name}: nov ${row.nov} · dic ${row.dec ?? "—"}${row.bill ? ` · cobro ${row.bill}` : ""}${c.status !== "ACTIVE" ? ` · ${c.status} → ACTIVE` : ""}`);
    if (apply) await db.client.update({ where: { id: c.id }, data: { status: "ACTIVE", closingOwed: row.nov, closingOwedDec: row.dec, closingBillKey: row.bill ?? null, closingNote: row.note ?? null, closingHold: false } });
  }
  // Counted clients she did not list keep what they owed at that moment (the count restarts from it).
  for (const [name, pending] of Object.entries(KEPT)) {
    const c = all.find((x) => x.name === name);
    if (!c) { console.log(`!! no existe: ${name}`); continue; }
    console.log(`(no vino en la lista) ${name}: queda en ${pending} de noviembre`);
    if (apply) await db.client.update({ where: { id: c.id }, data: { closingOwed: pending } });
  }
  const others = all.filter((c) => c.status === "ACTIVE" && c.closingOwed !== null && !listed.has(c.id) && !(c.name in KEPT));
  if (others.length) console.log(`!! contados sin tocar: ${others.map((c) => c.name).join(", ")}`);
  console.log(apply ? "APLICADO" : "dry run");
  await db.$disconnect();
})();
