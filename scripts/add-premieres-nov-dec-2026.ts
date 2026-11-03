/**
 * "calendario-estrenos-nov-dic-2026.pdf" (Esther, Nov 3 2026) → Calendario de eventos (FILM). Idempotent by name+year.
 */
import { db } from "../lib/db";
const ROWS: { name: string; month: number; day: number | null; city?: string; notes: string; url?: string }[] = [
  { name: "I Play Rocky · estreno limitado (Amazon MGM)", month: 11, day: 6, city: "Estados Unidos", notes: "✔ Fecha confirmada: 6 nov estreno limitado en cines EE. UU.; 20 nov expansión nacional. Premiere de Filadelfia (2 nov) ya pasada. Fuente: Amazon MGM / About Amazon." },
  { name: "I Play Rocky · expansión nacional (Amazon MGM)", month: 11, day: 20, city: "Estados Unidos", notes: "✔ Fecha confirmada: expansión nacional en cines EE. UU. Fuente: Amazon MGM." },
  { name: "How to Rob a Bank · proyección local Las Vegas", month: 11, day: 9, city: "Las Vegas", notes: "✔ Fecha confirmada: 9 nov 7:00 PM, AMC Town Square (UNLV). Sin confirmación de reparto. Estreno en cines: 13 nov." },
  { name: "How to Rob a Bank · estreno en cines", month: 11, day: 13, city: "Estados Unidos", notes: "✔ Fecha confirmada: estreno comercial en cines." },
  { name: "Focker-in-Law · premiere Nueva York (Universal)", month: 11, day: null, city: "New York", notes: "≈ Fecha tentativa: premiere en Nueva York en noviembre, día por definir. Evento para creadores: semana del 16 (tentativo). Estreno comercial: 25 nov. Fuente: Universal Pictures." },
  { name: "Focker-in-Law · estreno en cines (Universal)", month: 11, day: 25, city: "Estados Unidos", notes: "✔ Fecha confirmada: estreno comercial 25 nov. Fuente: Universal Pictures." },
  { name: "Way of the Warrior Kid · estreno Apple TV", month: 11, day: 25, city: "Apple TV", notes: "✔ Fecha confirmada: estreno en Apple TV el 25 nov. No corresponde a una premiere presencial. Fuente: Apple TV Press." },
  { name: "Jumanji · premiere Los Ángeles (Sony)", month: 12, day: 16, city: "Los Angeles", notes: "≈ Fecha tentativa: premiere en Los Ángeles según ficha de Charitybuzz, aún sin confirmación de Sony. Estreno en cines: 25 dic." },
  { name: "Jumanji · estreno en cines (Sony)", month: 12, day: 25, city: "Estados Unidos", notes: "✔ Fecha confirmada: estreno en cines EE. UU. 25 dic. Fuente: Sony Pictures." },
  { name: "Harry Potter · debut de la serie (HBO / HBO Max)", month: 12, day: 25, city: "HBO Max", notes: "✔ Fecha confirmada: debut de la serie en HBO / HBO Max el 25 dic. No se presenta como premiere presencial. Fuente: HarryPotter.com." },
];
async function main() {
  const esther = await db.user.findFirst({ where: { email: "esther@ebmanagement.io" }, select: { id: true } });
  let created = 0, skipped = 0;
  for (const r of ROWS) {
    const exists = await db.industryEvent.findFirst({ where: { year: 2026, name: { equals: r.name, mode: "insensitive" } }, select: { id: true } });
    if (exists) { skipped++; continue; }
    await db.industryEvent.create({ data: { name: r.name, category: "FILM", month: r.month, day: r.day, year: 2026, city: r.city ?? null, notes: r.notes, url: r.url ?? null, leadDays: 60, createdById: esther?.id ?? null } });
    created++;
  }
  // Emily in Paris (Dec 15, Paris) already exists: mark it tentative per the PDF.
  const emily = await db.industryEvent.findFirst({ where: { year: 2026, month: 12, day: 15, name: { contains: "Emily in Paris", mode: "insensitive" } } });
  if (emily && !(emily.notes ?? "").includes("tentativa")) await db.industryEvent.update({ where: { id: emily.id }, data: { notes: `≈ Fecha tentativa: referencia de planificación interna, sin confirmación oficial (PDF estrenos nov-dic 2026).${emily.notes ? `\n${emily.notes}` : ""}` } });
  console.log({ created, skipped, emilyUpdated: !!emily });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
