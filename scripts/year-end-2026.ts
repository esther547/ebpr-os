/**
 * Esther's year-end summary of Nov 16 2026 (the year closes Dec 15):
 *  1. active clients = her list (paused ones in it are reactivated, new ones are created; nobody is paused here);
 *  2. goals owed until Dec 15 per client → Client.closingOwed (the earlier count is discarded on the dashboard);
 *  3. every to-do of her notes → Prioridades of the current week, one line per person in charge.
 *   npx tsx scripts/year-end-2026.ts            # dry run
 *   npx tsx scripts/year-end-2026.ts --apply
 * Idempotent: clients by name, to-dos by (week, client, title, person).
 */
import { db } from "../lib/db";
import { slugify } from "../lib/utils";
import { dayKeyInTz, tzMidnight, weekStartKey } from "../components/runners/miami-time";

const E = "esther@ebmanagement.io", V = "veronicaf@ebmanagement.io", AY = "ayax@ebmanagement.io", AN = "aduran@ebmanagement.io", PP = "paolaprecilla@ebmanagement.io", PF = "pferreira@ebmanagement.io";
type Todo = [title: string, ...who: string[]];
type Entry = { match: string; create?: string; owed: number | null; note?: string; hold?: boolean; todos: Todo[] };

const LIST: Entry[] = [
  { match: "Hector Benitez", owed: 18, todos: [["Updates de Hector?", V]] },
  { match: "Marko", owed: 3, todos: [["Que Marko envíe hoy la idea de Meet the Fockers", E], ["Conclusión de Jumanji (diciembre)", AY], ["Agendar meeting de reunión de último año"]] },
  { match: "Lele Pons", owed: 0, todos: [["Cerrar entrevistas podcast"]] },
  { match: "Perro Negro", owed: 1, todos: [["Poner en agenda entregables de Vegas y partido de fútbol de Conmebol", AN], ["Encontrarle un toque en Art Basel"]] },
  { match: "Delfina Saud", owed: 16, todos: [["Media tour", AN], ["Prensa", V], ["Art Basel", PP]] },
  { match: "Daniela Fernandez", owed: 8, note: "8 pendientes hasta el 15", todos: [["Art Basel", PP]] },
  { match: "Camila Guiribitey", owed: 0, note: "Si desea continuar debe renovar", todos: [["Si desea continuar debe renovar", E], ["Emily in Paris Premiere", AN], ["Harry Potter Premiere", E], ["Influencer Gala Art Basel", PP]] },
  { match: "Pao Ruiz", owed: 12, todos: [["Art Basel", PP], ["Grabaciones con artistas"]] },
  { match: "Karime", owed: 6, todos: [["Art Basel", PP], ["Aston Martin", PP], ["Invitados para el podcast"]] },
  { match: "Lex Borrero", owed: 21, todos: [
    ["Lista de posibles medios para anuncio de eventos", V, PP],
    ["Difusión masiva y repercusión en medios de la venta de NEON 16 (Billboard, Variety, Messenger, Bloomberg, Hypebeast, etc.)", V, PP],
    ["Art Basel", PP],
    ["1 al 15 de diciembre: prep del opening del café", V, PP, PF],
  ] },
  { match: "Tatiana Guiribitey", owed: 6, todos: [["Art Basel", PP], ["Prensa", V], ["Media Tour", PF], ["Teletón", PF]] },
  { match: "Charlie Rincon", owed: null, todos: [["Follow up renovación y avisar al equipo", E]] },
  { match: "Daniella Duran", owed: 3, todos: [] },
  { match: "Poli", owed: 10, todos: [["Prensa: artista to \"watch out\"", V], ["Art Basel", PP]] },
  { match: "Emile Machado", owed: 6, todos: [
    ["Convocatoria de invitados para evento de Medellín (Luisa Castro, Dra. Paola, influencers con plata, amiguitas de Yudy Arias)", AN, AY, V],
    ["¿Hay alguna introducción que se haya hecho en el evento de Lex Borrero que le pueda contar como meta?", AY],
    ["Art Basel", PP],
  ] },
  { match: "Henry Arteaga", owed: 0, todos: [["Cuadrar meeting con Corillo", E]] },
  { match: "Beta Mejia", owed: 5, todos: [["Invitados para el podcast", PP, AY]] },
  { match: "Rico Rubio", owed: 4, todos: [["Teletón", PF], ["Art Basel", PP]] },
  { match: "Dra. Paola Ortiz", owed: 6, todos: [["Ejecutar estrategia", PF], ["Prensa y comunicado con Michel", PF], ["Gira de medios", PF, AN]] },
  { match: "Elaine Haro", owed: 0, todos: [["Actualizar agenda para mostrar en reunión", AN]] },
  { match: "Grace Andrea Bonilla", owed: 17, todos: [["Cuando se cumplan las 5 del primer mes, avisar", E], ["Cuando se cumplan las próximas 6 del segundo mes, avisar", E], ["Podcasts: Camila Guiribitey y podcasts en Miami", PP]] },
  { match: "Alex Ponce", owed: 6, note: "6 metas de noviembre", todos: [["Agendar Mucho Session", AY], ["Preguntar lanzamiento del siguiente sencillo y pitch a prensa", V, PF], ["Coordinar GRWM", AN]] },
  { match: "Humberto Marquina", create: "Humberto Marquina", owed: null, todos: [
    ["Estrategia perfil de Manager: entregar a Esther el jueves 19 nov para darle al talento el viernes 20 nov", AY],
    ["Ángulos para comunicado de prensa de Manager (viernes 20 nov)", PF],
    ["Art Basel", PP],
  ] },
  { match: "Michelle Paredes", create: "Michelle Paredes", owed: null, todos: [
    ["Estrategia de campaña y visa: entregar a Esther el jueves 19 nov para darle al talento el viernes 20 nov", AY],
    ["Art Basel", PP],
    ["Collab con creadores de contenido", AY],
    ["Podcasts", PP, PF],
  ] },
  { match: "Andy Rivera", create: "Andy Rivera", owed: null, todos: [
    ["Estrategia: entregar a Esther el jueves 19 nov para darle al talento el viernes 20 nov", AY],
    ["Reunión de equipo para brainstorm"],
  ] },
  // Esther, later the same day: "de los atrasos faltaría cumplirle a…"
  { match: "Marianela Ancheta", owed: 8, note: "Atrasos", todos: [] },
  { match: "Casa D", owed: 6, note: "Atrasos", todos: [] },
  { match: "Alejandra Jaramillo", owed: 8, note: "Atrasos · cliente en hold", hold: true, todos: [] },
];
// Not tied to a client ("PAOLA PRECILLA" heading of the notes).
const GENERAL: Todo[] = [["Llamar a Sol para Art Basel y hacerle agenda", PP]];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  const apply = process.argv.includes("--apply");
  const users = await db.user.findMany({ select: { id: true, email: true, name: true } });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const esther = byEmail.get(E);
  if (!esther) throw new Error("No existe el usuario de Esther");
  for (const e of [V, AY, AN, PP, PF]) if (!byEmail.get(e)) console.log(`!! falta el usuario ${e} (sus líneas quedarán sin asignar)`);
  let clients = await db.client.findMany({ select: { id: true, name: true, status: true, closingOwed: true } });
  const weekOf = tzMidnight(weekStartKey(dayKeyInTz(new Date())));
  console.log(`=== RESUMEN AL 15 DE DICIEMBRE ${apply ? "(APLICANDO)" : "(DRY RUN)"} · semana del ${weekStartKey(dayKeyInTz(new Date()))} ===`);

  // 1 + 2. clients and their count
  const listed = new Map<string, Entry>();
  for (const e of LIST) {
    let hits = clients.filter((c) => norm(c.name).includes(norm(e.match)));
    if (hits.length > 1) hits = hits.filter((c) => norm(c.name) === norm(e.match)).length === 1 ? hits.filter((c) => norm(c.name) === norm(e.match)) : hits;
    if (hits.length > 1) { console.log(`?? ${e.match}: varios clientes (${hits.map((h) => h.name).join(" / ")}) — no se toca`); continue; }
    let c = hits[0];
    if (!c) {
      if (!e.create) { console.log(`?? ${e.match}: no existe como cliente — no se toca`); continue; }
      console.log(`+ cliente nuevo: ${e.create} (activo, sin meta mensual todavía)`);
      if (!apply) continue;
      const base = slugify(norm(e.create)) || "client"; let slug = base;
      for (let i = 2; await db.client.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
      const created = await db.client.create({ data: { name: e.create, slug, status: "ACTIVE", monthlyTarget: 0 }, select: { id: true, name: true, status: true, closingOwed: true } });
      await db.activityLog.create({ data: { clientId: created.id, userId: esther.id, action: "client_created", description: `Created client ${created.name} (resumen de cierre 2026)` } });
      clients = [...clients, created]; c = created;
    }
    listed.set(c.id, e);
    const changes: string[] = [];
    if (c.status !== "ACTIVE") changes.push(`estado ${c.status} → ACTIVE`);
    if (c.closingOwed !== e.owed) changes.push(`metas al 15 dic: ${c.closingOwed ?? "—"} → ${e.owed ?? "sin número"}`);
    console.log(`${changes.length ? "~" : "✓"} ${c.name}${changes.length ? ": " + changes.join(" · ") : ""}`);
    if (apply) {
      await db.client.update({ where: { id: c.id }, data: { status: "ACTIVE", closingOwed: e.owed, closingNote: e.note ?? null, closingHold: !!e.hold } });
      if (c.status !== "ACTIVE") await db.activityLog.create({ data: { clientId: c.id, userId: esther.id, action: "client_updated", description: `Updated client ${c.name} — status: active (resumen de cierre 2026)` } });
    }
  }
  const outside = clients.filter((c) => c.status === "ACTIVE" && !listed.has(c.id));
  console.log(`\nActivos en el sistema que NO están en el resumen (se dejan activos, sin número): ${outside.map((c) => c.name).join(", ") || "ninguno"}`);
  console.log(`Total metas al 15 dic: ${[...listed.values()].reduce((n, e) => n + (e.owed ?? 0), 0)} en ${[...listed.values()].filter((e) => (e.owed ?? 0) > 0).length} clientes`);

  // 3. to-dos → Prioridades of this week, on top of each client's card
  const existing = await db.weeklyPriority.findMany({ where: { weekOf, list: "TEAM" }, select: { clientId: true, title: true, assigneeId: true, order: true } });
  const seen = new Set(existing.map((x) => `${x.clientId ?? ""}|${norm(x.title)}|${x.assigneeId ?? ""}`));
  const minOrder = new Map<string, number>();
  for (const x of existing) minOrder.set(x.clientId ?? "", Math.min(minOrder.get(x.clientId ?? "") ?? 0, x.order));
  let created = 0, skipped = 0;
  const perPerson = new Map<string, number>();
  const groups: { clientId: string | null; name: string; todos: Todo[] }[] = [
    ...[...listed.entries()].map(([id, e]) => ({ clientId: id as string | null, name: clients.find((c) => c.id === id)!.name, todos: e.todos })),
    { clientId: null, name: "General", todos: GENERAL },
  ];
  console.log("");
  for (const g of groups) {
    const lines = g.todos.flatMap(([title, ...who]) => (who.length ? who : [null]).map((email) => ({ title, email })));
    const start = (minOrder.get(g.clientId ?? "") ?? 0) - lines.length - 1;
    for (let i = 0; i < lines.length; i++) {
      const { title, email } = lines[i];
      const u = email ? byEmail.get(email) ?? null : null;
      const key = `${g.clientId ?? ""}|${norm(title)}|${u?.id ?? ""}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      console.log(`  ${g.name.padEnd(30)} ${title.slice(0, 80)}${u ? "  → " + u.name : "  (sin asignar)"}`);
      perPerson.set(u?.name ?? "Sin asignar", (perPerson.get(u?.name ?? "Sin asignar") ?? 0) + 1);
      if (apply) await db.weeklyPriority.create({ data: { weekOf, list: "TEAM", clientId: g.clientId, title: title.slice(0, 200), assigneeId: u?.id ?? null, order: start + i, createdById: esther.id } });
      created++;
    }
  }
  console.log(`\nTo dos: ${created} línea(s) ${apply ? "creadas" : "por crear"}, ${skipped} ya existían.`);
  console.log([...perPerson.entries()].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n}: ${k}`).join(" · "));
  console.log(apply ? "APLICADO" : "DRY RUN (nada cambió)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
