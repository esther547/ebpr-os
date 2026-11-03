/**
 * Universal Pictures premieres 2027 (Esther, Nov 3 2026) → Calendario de eventos as FILM events on the US release day.
 * Idempotent: skips an event that already exists with the same name and year.
 *   DATABASE_URL=… DIRECT_URL=… npx tsx scripts/add-universal-premieres-2027.ts
 */
import { db } from "../lib/db";

const ROWS: { name: string; month: number; day: number; cast: string; url: string; links?: string }[] = [
  { name: "River (Universal)", month: 1, day: 15, cast: "Jane Levy, Jessica Rothe, Dane DiLiegro", url: "https://www.imdb.com/title/tt33085567/", links: "Trailer: https://youtu.be/ox8lEnsxDag · Getty: https://dam.gettyimages.com/universal/river" },
  { name: "The Comeback King (Universal)", month: 2, day: 5, cast: "Dir. Judd Apatow · Glen Powell, Madelyn Cline, Cristin Milioti", url: "https://www.imdb.com/title/tt36593129/", links: "Getty: https://dam.gettyimages.com/universal/thecomebackking" },
  { name: "CoComelon: The Movie (Universal)", month: 2, day: 19, cast: "SZA, Ike Barinholtz, Nicholas Hoult, Sarah Sherman, Ego Nwodim", url: "https://www.imdb.com/title/tt31339071/", links: "Teaser: https://www.youtube.com/watch?v=-rzG116pLbw · Getty: https://dam.gettyimages.com/universal/cocomelonthemovie" },
  { name: "The Exorcist: Martyrs (Universal)", month: 3, day: 12, cast: "Scarlett Johansson, Chiwetel Ejiofor, John Leguizamo", url: "https://www.imdb.com/title/tt32492552/", links: "Trailer: https://youtu.be/iIEYfH-jg1Y · Getty: https://dam.gettyimages.com/universal/theexorcistmartyrs" },
  { name: "Not Alone (Universal)", month: 4, day: 16, cast: "Timothée Chalamet, Selena Gomez, Brett Goldstein", url: "https://www.imdb.com/title/tt43609247/", links: "Trailer: https://youtu.be/wtUdmUTNbO4 · Getty: https://dam.gettyimages.com/universal/notalone" },
  { name: "The Catch (Universal)", month: 5, day: 21, cast: "Emma Stone, Chris Pine", url: "https://www.imdb.com/title/tt32102935/" },
  { name: "How to Train Your Dragon 2 – live action (Universal)", month: 6, day: 11, cast: "Gerard Butler, Mason Thames, Nico Parker", url: "https://www.imdb.com/title/tt36416299/" },
  { name: "Shrek 5 (Universal)", month: 6, day: 30, cast: "Zendaya, Marcello Hernandez, Skyler Gisondo", url: "https://www.imdb.com/title/tt6113186/", links: "Teaser: https://youtu.be/Swiz1XyfhcI · Getty: https://dam.gettyimages.com/universal/shrek5" },
  { name: "The Mummy: Book of the Dead (Universal)", month: 10, day: 15, cast: "Brendan Fraser", url: "https://www.imdb.com/title/tt22408968/" },
];

async function main() {
  const esther = await db.user.findFirst({ where: { email: "esther@ebmanagement.io" }, select: { id: true } });
  let created = 0, skipped = 0;
  for (const r of ROWS) {
    const exists = await db.industryEvent.findFirst({ where: { year: 2027, name: { equals: r.name, mode: "insensitive" } }, select: { id: true } });
    if (exists) { skipped++; continue; }
    await db.industryEvent.create({ data: { name: r.name, category: "FILM", month: r.month, day: r.day, year: 2027, city: "Estados Unidos", notes: `✔ Fecha confirmada: estreno en cines (US). Premiere Universal Pictures · ${r.cast}${r.links ? `\n${r.links}` : ""}`, url: r.url, leadDays: 60, createdById: esther?.id ?? null } });
    created++;
  }
  console.log({ created, skipped, total: await db.industryEvent.count({ where: { year: 2027, category: "FILM" } }) });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
