/**
 * Charlie Rincón: make the portal agenda mirror the Google Doc EXACTLY (Esther, Nov 3 2026) —
 * 8 blocks MARZO…OCTUBRE in the doc's row order. Existing units are reused (dates/names aligned to the doc);
 * missing rows are created; units not in the doc are left pending (never deleted).
 */
import { db } from "../lib/db";
import { assignPeriod } from "../lib/service-periods";
import { tzMidnight } from "../components/runners/miami-time";

const C = "cmnp97qn1001040f2m6ksuw1r";
const VT = "\u000b";
type R = { seq: number; day: string; min?: number; venue?: string | null; name: string; notes?: string | null; pending?: boolean; existing?: string; goalId?: string };
type Block = { number: number; label: string; refMonth: number; rows: R[] };

const BLOCKS: Block[] = [
  { number: 1, label: "Marzo 2026", refMonth: 3, rows: [
    { seq: 1, day: "2026-03-19", min: 17 * 60, venue: "Kaseya Center", name: "PREMIOS LO NUESTRO", notes: "Alfombra roja" },
    { seq: 3, day: "2026-03-12", min: 19 * 60, venue: "Lafayette Miami\n1111 SW 1st Avenue", name: `LOUIS VUITTON${VT}Launch Dinner Women Spring-Summer 2026 Collection`, notes: "PR: Esther Beniflah" },
    { seq: 4, day: "2026-03-13", min: 12 * 60, venue: "Louis Vuitton Miami Design District Women’s 130 NE 39st", name: "LOUIS VUITTON", notes: "Launch Private Women Spring-Summer 2026\nPreview Collection\nPR: Esther Beniflah" },
    { seq: 5, day: "2026-03-17", min: 19 * 60, venue: "Miami Beach", name: "LACOSTE PARTY", notes: "Miami Open" },
    { seq: 6, day: "2026-04-08", min: 19 * 60, venue: "Donatella Boutique Hotel and Restaurant", name: "CASA HOLA DONATELLA" },
    { seq: 7, day: "2026-10-04", min: 11 * 60, venue: "412 ridgewood rd, Key Biscayne", name: "E- NOW LATINO", notes: "Creación de Contenido\nPending", existing: "agimp_dad21897a0de7302" },
    { seq: 8, day: "2026-11-06", min: 22 * 60 + 30, venue: "Harbour Club", name: "DOLCE & GABBANA", notes: "Evento privado de celebracion del dia del padres con D&G\nPending", existing: "agimp_79e441a321d31872" },
    { seq: 9, day: "2026-11-09", venue: "Cuestionario", name: "COOL THE LIFESTYLE", notes: "Entrevista Venice Film Festival\nPending", pending: true, existing: "agimp_f5fa553d6444b41e" },
    { seq: 10, day: "2026-12-03", min: 19 * 60, venue: "Lafayette Miami\n1111 SW 1st Avenue", name: `LOUIS VUITTON${VT}Launch Dinner Women Spring-Summer 2026 Collection`, notes: "PR: Esther Beniflah\nPending", pending: true, existing: "agimp_77b022915f016d48" },
  ] },
  { number: 2, label: "Abril 2026", refMonth: 4, rows: [
    { seq: 1, day: "2026-04-17", venue: "Cuestionario", name: "EL ESPECTADOR", notes: "Looks de los Oscars" },
    { seq: 2, day: "2026-04-15", min: 14 * 60, venue: "Park Grove 2821 S Bayshore Dr. LPHA Coconut Grove, FL 33133", name: "THE CINEMA OF INTERIOR DESIGN", notes: "Vogue x Karla Martinez de Sala" },
    { seq: 3, day: "2026-04-07", venue: "Virtual", name: "E- NOW Latino" },
    { seq: 4, day: "2026-04-17", min: 10 * 60 + 15, venue: "Univision", name: "DESIGUALES TV" },
    { seq: 5, day: "2026-04-29", min: 16 * 60 + 45, venue: "Kimpton EPIC Hotel", name: "THE DEVIL WEARS PRADA PREMIERE" },
    { seq: 6, day: "2026-05-06", min: 11 * 60, venue: "Doral", name: "RCN INTERNACIONAL" },
  ] },
  { number: 3, label: "Mayo 2026", refMonth: 5, rows: [
    { seq: 1, day: "2026-04-05", min: 17 * 60, venue: "Met Gala Watch Party", name: "MANUELA VARGAS", notes: "Influencer y creadora de contenido\nhttps://www.instagram.com/manuelavargas/" },
    { seq: 2, day: "2026-04-05", min: 17 * 60, venue: "Met Gala Watch Party", name: "CONSTANZA VIERA", notes: "Private Jeweler\nhttps://www.instagram.com/diamondtales/" },
    { seq: 3, day: "2026-05-05", min: 17 * 60, venue: "Met Gala Watch Party", name: "SOMOS LA REVISTA", notes: "Nota para trámite de visa de Charlie para el evento del Met Gala Watch Party\nhttps://somoslarevistausa.com/the-first-kiki-in-may-el-exclusivo-watch-party-del-met-gala-presentado-por-charlie-rincon-que-reunio-a-la-industria-de-la-moda-en-miami/?fbclid=PAVERFWARsI51leHRuA2FlbQIxMABzcnRjBmFwcF9pZA8xMjQwMjQ1NzQyODc0MTQAAacOVArm0pofB0ylxk-BEVEboSysOKKW2u8GfySiC0lZQesSj8ddC6rIcpRI7Q_aem_uj9gVbcq7Hs7Z63FymxdMw" },
    { seq: 4, day: "2026-05-06", venue: "Cuestionario", name: "LA VANGUARDIA" },
    { seq: 5, day: "2026-05-29", min: 18 * 60, venue: "Temple House", name: "CUPSHE MIAMI SWIM WEEK" },
    { seq: 6, day: "2026-05-27", min: 17 * 60, venue: "Casa Colombia Moda\nThrow Social, Miami Wynwood", name: "OPENING RUNWAY BY RENATA LOZANO" },
  ] },
  { number: 4, label: "Junio 2026", refMonth: 6, rows: [
    { seq: 1, day: "2026-05-30", min: 20 * 60 + 30, venue: "Paraiso Tent\nMiami Beach", name: "DESFILE VOGUE X MIAMI SWIM WEEK" },
    { seq: 2, day: "2026-05-29", min: 21 * 60, venue: "Paraiso Tent\nMiami Beach", name: "OSEREE SHOW" },
    { seq: 3, day: "2026-05-28", min: 12 * 60, venue: "FAENA Hotel\nMiami Beach", name: "GIFTING SUITE BY MARYSOL PATTON AND WILLIAM KIRST" },
    { seq: 4, day: "2026-05-28", min: 18 * 60, venue: "Paraiso Tent\nMiami Beach", name: "MONDAY SWIMWEAR SHOW" },
    { seq: 5, day: "2026-06-11", min: 19 * 60, venue: "Harbour Club", name: "DOLCE & GABANNA", notes: "Fathers Day Private Event" },
    { seq: 6, day: "2026-06-11", venue: "Virtual", name: "REVISTA HOLA", notes: "Artículo de Charlie como experto sobre el estilo de Emily Blunt\nPublicación acá\nPending", pending: true, existing: "agimp_174a450dce83044f" },
  ] },
  { number: 5, label: "Julio 2026", refMonth: 7, rows: [
    { seq: 1, day: "2026-06-19", venue: "Cuestionario", name: "ENTREVISTA PLAYGROUND" },
    { seq: 2, day: "2026-06-24", venue: "MINT Studio", name: "PORTADA PAPER ESPANOL", notes: "Lele Pons" },
    { seq: 4, day: "2026-06-30", venue: "—", name: "REYKON X KIDSUPER", notes: "Reykon mencionó a Charlie en redes como su estilista" },
    { seq: 5, day: "2026-07-03", venue: "—", name: "ARTICULO SOMOS OH LALA" },
    { seq: 6, day: "2026-07-09", venue: "N/A", name: `MAN OF MANY${VT}Expert commentary Sandalias` },
  ] },
  { number: 6, label: "Agosto 2026", refMonth: 8, rows: [
    { seq: 1, day: "2026-07-24", venue: "Cuestionario", name: "MAN OF MANY", notes: "Expert commentary Leather Jackets\nPublicación acá" },
    { seq: 2, day: "2026-08-10", venue: "Cuestionario", name: "MAN OF MANY", notes: "Expert commentary Graphic Tees\nPublicación acá" },
    { seq: 3, day: "2026-08-07", venue: "—", name: "FUNDACION SUNRISAS", notes: "Se consiguió partnership con Sunrisas para el evento con Alice and Olivia" },
    { seq: 4, day: "2026-08-14", venue: "Cuestionario", name: "MAN OF MANY", notes: "Expert commentary men wearing colors\nPublicación pendiente", existing: "agimp_216ac1eb7726304b" },
    { seq: 5, day: "2026-08-13", venue: "Instagram", name: "BLOGS", notes: "Ambos blogs postearon en redes el evento de Charlie con Alice and Olivia.\nChicas Guapas TV:\nhttps://www.instagram.com/chicasguapastv/\nTe Conte Miami:\nhttps://www.instagram.com/tecontemiami/", existing: "agimp_566018a297317c3b" },
    { seq: 6, day: "2026-08-13", venue: "Instagram", name: "STEPHANY ABASALI", notes: "Miss Venezuela 2025 posteo en redes el evento de Charlie con Alice and Olivia para visibilidad", existing: "agimp_4ad05ca46f2b887e" },
  ] },
  { number: 7, label: "Septiembre 2026", refMonth: 9, rows: [
    { seq: 1, day: "2026-08-27", venue: "MDD", name: "LOUIS VUITTON WOMEN", notes: "Private Pop Up Opening" },
    { seq: 2, day: "2026-01-09", venue: "N/A", name: `EL TIEMPO ${VT}Expert commentary El Tiempo` },
    { seq: 3, day: "2026-09-11", venue: "Cuestionario", name: "COOL THE LIFESTYLE", notes: "Entrevista Venice Film Festival\nPending", pending: true },
    { seq: 4, day: "2026-09-14", venue: "Cuestionario", name: "OK DIARIO", notes: "Comentario estilismo las infantas" },
    { seq: 5, day: "2026-09-20", venue: null, name: "Refinery 29 social collab Campillo", goalId: "cmuksuexw000xffw0mmnxxb5l" },
    { seq: 6, day: "2026-10-08", min: 18 * 60, venue: "Nordstrom Merrick Park", name: "LAFS X NORDSTROM", goalId: "cmuzsevuy0005645we8ndt744" },
  ] },
  { number: 8, label: "Octubre 2026", refMonth: 10, rows: [
    { seq: 1, day: "2026-10-12", venue: "Website", name: "HOLA ESPANA COMMENTARY", notes: "Artículo de estilo de Tamara Falco", existing: "cmv725aiv0003f0v1dnpyh1p5" },
    { seq: 2, day: "2026-11-01", venue: "TBA", name: "VOGUE LEADERS" },
    { seq: 3, day: "2026-11-02", min: 16 * 60 + 30, venue: "Adrienne Center", name: "GALA HOLA USA!" },
  ] },
];

const at = (day: string, min?: number) => new Date(tzMidnight(day).getTime() + (min ?? 16 * 60) * 60_000); // no hour → noon-ish anchor, eventTime left null

async function main() {
  const now = new Date();
  // 1. Periods: Enero→Marzo(1), Febrero→Abril(2), Marzo→Mayo(3), Octubre→number 8; create 4-7.
  const cur = await db.servicePeriod.findMany({ where: { clientId: C }, orderBy: { number: "asc" } });
  const byNum = new Map(cur.map((p) => [p.number, p]));
  const oct = cur.find((p) => p.refMonth === 10);
  if (oct && oct.number !== 8) await db.servicePeriod.update({ where: { id: oct.id }, data: { number: 8 } });
  const periodId: Record<number, string> = {};
  for (const b of BLOCKS) {
    const ex = b.number === 8 ? oct : byNum.get(b.number);
    if (ex) { await db.servicePeriod.update({ where: { id: ex.id }, data: { label: b.label, refYear: 2026, refMonth: b.refMonth, target: 6 } }); periodId[b.number] = ex.id; }
    else { const p = await db.servicePeriod.create({ data: { clientId: C, number: b.number, label: b.label, refYear: 2026, refMonth: b.refMonth, target: 6 } }); periodId[b.number] = p.id; }
  }
  // 2. Rows
  const touched = new Set<string>(); let created = 0, updated = 0;
  for (const b of BLOCKS) for (const r of b.rows) {
    const eventDate = at(r.day, r.min);
    const eventTime = r.min !== undefined ? at(r.day, r.min) : null;
    const data = { eventName: r.name, eventDate, weekOf: eventDate, eventTime, venueName: r.venue ?? null, venueAddress: null, notes: r.notes ?? null, isProposal: !!r.pending, agendaSequence: r.seq, agendaMonth: b.refMonth, agendaYear: 2026, agendaMonthPinned: true, periodSource: "manual" as const };
    let id = r.existing ?? null;
    if (id) { await db.runnerAssignment.update({ where: { id }, data: { ...data, internalNotes: undefined } }); updated++; }
    else {
      const row = await db.runnerAssignment.create({ data: { clientId: C, ...data, status: eventDate < now ? "COMPLETED" : "SCHEDULED", deliverableId: r.goalId ?? null, internalNotes: "Cargada desde el Google Doc (copia exacta, Nov 2026)." }, select: { id: true } });
      id = row.id; created++;
      if (r.goalId) await db.deliverable.update({ where: { id: r.goalId }, data: { dueDate: eventDate, eventTime, venueName: r.venue ?? null } }).catch(() => null);
    }
    touched.add(id);
    await assignPeriod({ pautaId: id }, periodId[b.number], { source: "manual" });
    await db.runnerAssignment.update({ where: { id }, data: { agendaSequence: r.seq } });
  }
  // 3. Anything else still sitting in a period but not in the doc → pending (not deleted)
  const strays = await db.runnerAssignment.findMany({ where: { clientId: C, id: { notIn: [...touched] }, periodId: { not: null } }, select: { id: true, eventName: true } });
  for (const s of strays) await assignPeriod({ pautaId: s.id }, null, { source: "manual" });
  const linked = new Set((await db.runnerAssignment.findMany({ where: { clientId: C, deliverableId: { not: null } }, select: { deliverableId: true } })).map((x) => x.deliverableId!));
  const strayGoals = (await db.deliverable.findMany({ where: { clientId: C, periodId: { not: null } }, select: { id: true, title: true } })).filter((g) => !linked.has(g.id));
  for (const g of strayGoals) await assignPeriod({ goalId: g.id }, null, { source: "manual" });
  console.log({ created, updated, strays: strays.map((s) => s.eventName), strayGoals: strayGoals.map((g) => g.title) });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
