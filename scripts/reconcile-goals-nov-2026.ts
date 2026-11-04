/**
 * Esther's goal accounting of Nov 3 2026 (client · month of origin · pending) becomes the truth in the portal:
 * each listed month gets a period whose target = achieved + pending; a client's pending month not in her list is
 * settled (target = achieved) with a note that records what it was; November targets are set as listed.
 *   npx tsx scripts/reconcile-goals-nov-2026.ts            # dry run
 *   npx tsx scripts/reconcile-goals-nov-2026.ts --apply
 */
import { db } from "../lib/db";
import { periodBoard } from "../lib/service-periods";

const M: Record<string, number> = { Mayo: 5, Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11 };
// client (name fragment) → month → pending (null = "por confirmar" / sin cantidad: keep as is, note only)
const LIST: Record<string, Record<string, number | null>> = {
  "Lex Borrero": { Mayo: 5, Agosto: 5, Septiembre: 5, Noviembre: 5 },
  "Aleska": { Julio: 5 },
  "Perro Negro": { Septiembre: null },
  "Mami Lover": { Septiembre: 6 },
  "Pao Ruiz": { Septiembre: 3, Octubre: 4, Noviembre: 4 },
  "Alejandra Jaramillo": { Septiembre: 6 },
  "Daniela Fernandez": { Septiembre: 1, Octubre: 5, Noviembre: 4 },
  "Na'vi": { Septiembre: 1 },
  "Charlie Rincon": { Octubre: 3 },
  "Delfina Saud": { Octubre: 6, Noviembre: 6 },
  "Grace Andrea Bonilla": { Octubre: 5, Noviembre: 6 },
  "Alex Ponce": { Octubre: 2, Noviembre: 6 },
  "Dra. Paola Ortiz": { Octubre: 1, Noviembre: 8 },
  "Emile Machado": { Octubre: 5 },
  "Marianela": { Octubre: 12 },
  "Casa D": { Noviembre: 8 },
  "Hector Benitez": { Noviembre: 8 }, // Benme Legal / IT (TPS)
  "Marko": { Noviembre: 8 }, // "8 metas o una oportunidad de gran impacto" (alternativas)
  "Rico Rubio": { Noviembre: 6 },
  "Elaine Haro": { Noviembre: 6 },
  "Lele Pons": { Noviembre: null },
  "Beta Mejia": { Noviembre: 6 },
  "Karime": { Noviembre: null },
};
const NOTE = (what: string) => `Conteo de Esther (3 nov 2026): ${what}`;

async function main() {
  const apply = process.argv.includes("--apply");
  const clients = await db.client.findMany({ select: { id: true, name: true, status: true, monthlyTarget: true } });
  const find = (frag: string) => clients.filter((c) => c.name.toLowerCase().includes(frag.toLowerCase()));
  const touched = new Set<string>();
  for (const [frag, months] of Object.entries(LIST)) {
    const hits = find(frag);
    if (hits.length !== 1) { console.log(`?? ${frag}: ${hits.length ? hits.map((h) => h.name + " (" + h.status + ")").join(" / ") : "NO EXISTE como cliente"}`); continue; }
    const c = hits[0]; touched.add(c.id);
    const board = await periodBoard(c.id);
    for (const [mon, pending] of Object.entries(months)) {
      const ref = M[mon];
      let p = board.periods.find((x) => x.refYear === 2026 && x.refMonth === ref);
      if (!p) {
        const n = (board.periods[board.periods.length - 1]?.number ?? 0) + 1;
        console.log(`+ ${c.name}: crear Mes ${n} · ${mon} 2026 con meta ${pending ?? 0}${pending === null ? " (por definir)" : ""}`);
        if (apply) { const created = await db.servicePeriod.create({ data: { clientId: c.id, number: n, label: `${mon} 2026`, refYear: 2026, refMonth: ref, target: pending ?? 0, note: pending === null ? NOTE("cantidad por definir") : NOTE(`${pending} pendientes de ${mon.toLowerCase()}`) } }); board.periods.push({ ...created, units: [], achieved: 0, closedPending: 0, executed: 0, missing: pending ?? 0, toReview: 0 } as any); }
        continue;
      }
      if (pending === null) { console.log(`= ${c.name}: ${mon} se deja como está (${p.achieved}/${p.target}, faltan ${p.missing}) · nota "por confirmar"`); if (apply) await db.servicePeriod.update({ where: { id: p.id }, data: { note: NOTE(mon === "Noviembre" ? "sin cantidad definida" : "cantidad por confirmar") } }); continue; }
      const target = ref === 11 ? pending : p.achieved + pending; // noviembre = trabajo previsto del mes; meses anteriores = lo que falta
      if (target !== p.target) { console.log(`~ ${c.name}: ${mon} meta ${p.target} → ${target} (cerradas ${p.achieved}, pendientes ${pending}; antes faltaban ${p.missing})`); if (apply) await db.servicePeriod.update({ where: { id: p.id }, data: { target, note: NOTE(`${pending} pendientes de ${mon.toLowerCase()}; meta anterior ${p.target}`) } }); }
      else console.log(`✓ ${c.name}: ${mon} ya cuadra (faltan ${pending})`);
    }
    // months with pending in the portal that Esther's list does not owe → settled
    for (const p of board.periods) {
      const listed = Object.keys(months).some((mon) => M[mon] === p.refMonth && p.refYear === 2026);
      const overdueMonth = p.refYear < 2026 || (p.refYear === 2026 && p.refMonth <= 10);
      if (!listed && overdueMonth && p.missing > 0 && p.target > 0) { console.log(`- ${c.name}: ${p.label} faltaban ${p.missing} → se da por saldado (meta ${p.target} → ${p.achieved})`); if (apply) await db.servicePeriod.update({ where: { id: p.id }, data: { target: p.achieved, note: NOTE(`no se debe; meta anterior ${p.target}, faltaban ${p.missing}`) } }); }
    }
  }
  // active clients with pending months that are not in Esther's list at all
  for (const c of clients.filter((x) => x.status === "ACTIVE" && !touched.has(x.id))) {
    const board = await periodBoard(c.id);
    for (const p of board.periods) if ((p.refYear < 2026 || (p.refYear === 2026 && p.refMonth <= 10)) && p.missing > 0 && p.target > 0) { console.log(`- ${c.name} (no está en la lista): ${p.label} faltaban ${p.missing} → se da por saldado (meta ${p.target} → ${p.achieved})`); if (apply) await db.servicePeriod.update({ where: { id: p.id }, data: { target: p.achieved, note: NOTE(`no está en la lista; meta anterior ${p.target}, faltaban ${p.missing}`) } }); }
  }
  if (apply) {
    for (const id of touched) {
      const ps = await db.servicePeriod.findMany({ where: { clientId: id }, orderBy: [{ refYear: "asc" }, { refMonth: "asc" }, { number: "asc" }] });
      for (let i = 0; i < ps.length; i++) await db.servicePeriod.update({ where: { id: ps[i].id }, data: { number: -(i + 1) } });
      for (let i = 0; i < ps.length; i++) await db.servicePeriod.update({ where: { id: ps[i].id }, data: { number: i + 1 } });
    }
    const marko = await db.client.findFirst({ where: { name: { contains: "Marko", mode: "insensitive" } }, select: { id: true } });
    if (marko) await db.servicePeriod.updateMany({ where: { clientId: marko.id, refYear: 2026, refMonth: 11 }, data: { note: NOTE("8 metas o una oportunidad de gran impacto (alternativas, no se suman)") } });
  }
  console.log(apply ? "APLICADO" : "DRY RUN (nada cambió)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
