/**
 * OFF THE RECORD ticket buyers (BUYERS - Order Details PDF → pdftotext -layout). Adds them to Contactos → Industria
 * musical with the tag "Off The Record · buyer" (existing contacts only gain the tag) and sends the "es mañana"
 * reminder to the ones who did not already get it (i.e. were not in the list when the mass send went out).
 *   npx tsx scripts/otr-buyers.ts <buyers.txt> [--send]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { invitationHtml, type Flyer } from "../lib/outreach";
import { sendEmail } from "../lib/email";

const TAG = "Off The Record · buyer";
const LIST = "Music Industry";
const SUBJECT = "Es mañana: OFF THE RECORD | CMN & LA INDUSTRIA INC.";
const SIGN = "CMN, Cardenas Marketing Network & La Industria Inc.";
const BODY = `¡Es mañana! Nos vemos en OFF THE RECORD.

CMN y La Industria Inc. te esperan en este encuentro exclusivo para profesionales de la industria musical y del entretenimiento, en el marco de Latin Music Week.

Fecha: Miércoles, 21 de octubre
Hora: 7:00 p. m. – 10:00 p. m.
Open Bar: 7:00 p. m. – 9:00 p. m.
Lugar: Midline Miami
Dirección: 2221 NW Miami Ct, Miami, FL 33127 (rideshare recomendado)

Recuerda que la invitación es personal e intransferible.

¡Nos vemos mañana!

${SIGN}

———

It's tomorrow! See you at OFF THE RECORD.

CMN and La Industria Inc. look forward to welcoming you to this exclusive gathering for music and entertainment industry professionals during Latin Music Week.

Date: Wednesday, October 21
Time: 7:00 PM – 10:00 PM
Open Bar: 7:00 PM – 9:00 PM
Venue: Midline Miami
Address: 2221 NW Miami Ct, Miami, FL 33127 (rideshare recommended)

Please remember the invitation is personal and non-transferable.

See you tomorrow!

${SIGN}`;

const cap = (s: string) => s.trim().split(/\s+/).map((w) => (w === w.toUpperCase() || w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");

async function main() {
  const file = process.argv[2]; const send = process.argv.includes("--send");
  const rows = new Map<string, { first: string; last: string }>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*(\S+@\S+\.\S+)\s{2,}(.+?)\s{2,}(.+?)\s*$/.exec(line);
    if (!m || /email address/i.test(m[1])) continue;
    const email = m[1].toLowerCase();
    if (!rows.has(email)) rows.set(email, { last: cap(m[2]), first: cap(m[3]) });
  }
  const existing = await db.outreachContact.findMany({ where: { isActive: true, email: { in: [...rows.keys()], mode: "insensitive" } }, select: { id: true, email: true, tags: true, list: true } });
  const byEmail = new Map(existing.map((c) => [(c.email ?? "").toLowerCase(), c]));
  const newOnes = [...rows].filter(([e]) => !byEmail.has(e));
  console.log({ buyers: rows.size, alreadyInBase: existing.length, new: newOnes.length });
  if (!send) { console.log(newOnes.slice(0, 10).map(([e, n]) => `${n.first} ${n.last} <${e}>`).join("\n")); return; }

  for (const c of existing) if (!c.tags.includes(TAG)) await db.outreachContact.update({ where: { id: c.id }, data: { tags: [...c.tags, TAG] } });
  for (const [email, n] of newOnes) await db.outreachContact.create({ data: { list: LIST, name: `${n.first} ${n.last}`.trim(), email, category: "Buyer OFF THE RECORD", source: "BUYERS - Order Details (Oct 20 2026)", tags: [TAG] } });

  const flyer: Flyer = { filename: "off-the-record-2026.jpg", content: readFileSync(path.join(process.cwd(), "public/invites/off-the-record-2026.jpg")), contentType: "image/jpeg" };
  const html = invitationHtml(SUBJECT, BODY, flyer, { fromName: "OFF THE RECORD", header: "", footer: "" });
  const emails = newOnes.map(([e]) => e);
  let sent = 0, batches = 0;
  for (let i = 0; i < emails.length; i += 50) {
    const bcc = emails.slice(i, i + 50);
    const ok = await sendEmail({ to: process.env.GMAIL_USER!, bcc, replyTo: "esther@ebmanagement.io", subject: SUBJECT, html, text: BODY, attachments: [{ ...flyer, cid: "flyer" }], fromName: "OFF THE RECORD" });
    batches++; if (ok) sent += bcc.length; else console.error("batch failed", batches);
    await new Promise((r) => setTimeout(r, 400));
  }
  const esther = await db.user.findFirst({ where: { email: "esther@ebmanagement.io" }, select: { id: true } });
  await db.outreachSend.create({ data: { list: LIST, subject: SUBJECT, body: BODY, categories: ["Buyers (nuevos en la base)"], tags: [TAG], recipientCount: sent, sentById: esther?.id ?? null } });
  console.log({ sent, batches, tagged: existing.length, created: newOnes.length });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
