/**
 * OFF THE RECORD (Oct 21 2026) — "es mañana" reminder. Same art, same sender, same signature as the invitation.
 *   --test=email            send the reminder as [Prueba] to one address
 *   --mass                  real send: one version to everyone in Industria with email (confirmed + invited)
 * Env: DATABASE_URL/DIRECT_URL (prod), APP_SECRET, GMAIL_USER.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { sendOutreach, type Flyer } from "../lib/outreach";

const CONFIRMED_TAG = "Off The Record · confirmado";
const SUBJECT = "Es mañana: OFF THE RECORD | CMN & LA INDUSTRIA INC.";
const DETAILS_ES = `Fecha: Miércoles, 21 de octubre
Hora: 7:00 p. m. – 10:00 p. m.
Open Bar: 7:00 p. m. – 9:00 p. m.
Lugar: Midline Miami
Dirección: 2221 NW Miami Ct, Miami, FL 33127 (rideshare recomendado)`;
const DETAILS_EN = `Date: Wednesday, October 21
Time: 7:00 PM – 10:00 PM
Open Bar: 7:00 PM – 9:00 PM
Venue: Midline Miami
Address: 2221 NW Miami Ct, Miami, FL 33127 (rideshare recommended)`;
const SIGN = "CMN, Cardenas Marketing Network & La Industria Inc.";

const BODIES: Record<string, string> = {
  todos: `¡Es mañana! Nos vemos en OFF THE RECORD.

CMN y La Industria Inc. te esperan en este encuentro exclusivo para profesionales de la industria musical y del entretenimiento, en el marco de Latin Music Week.

${DETAILS_ES}

Recuerda que la invitación es personal e intransferible.

¡Nos vemos mañana!

${SIGN}

———

It's tomorrow! See you at OFF THE RECORD.

CMN and La Industria Inc. look forward to welcoming you to this exclusive gathering for music and entertainment industry professionals during Latin Music Week.

${DETAILS_EN}

Please remember the invitation is personal and non-transferable.

See you tomorrow!

${SIGN}`,
};

async function main() {
  const args = process.argv.slice(2);
  const test = args.find((a) => a.startsWith("--test="))?.slice(7);
  const mass = args.includes("--mass");
  const file = path.join(process.cwd(), "public/invites/off-the-record-2026.jpg");
  const flyer: Flyer = { filename: "off-the-record-2026.jpg", content: readFileSync(file), contentType: "image/jpeg" };
  const common = { list: "Music Industry", subject: SUBJECT, replyTo: "esther@ebmanagement.io", flyer, brand: { fromName: "OFF THE RECORD", header: "", footer: "" } };
  const esther = await db.user.findFirst({ where: { email: "esther@ebmanagement.io" }, select: { id: true } });
  if (test) {
    const r = await sendOutreach({ ...common, body: BODIES.todos, testTo: test });
    console.log("todos →", test, r);
    return;
  }
  if (mass) {
    // One version to the whole Industria list (confirmed and invited alike); Medios stays out, as with the invitation.
    const r = await sendOutreach({ ...common, body: BODIES.todos, sentById: esther?.id });
    console.log("todos", r);
    return;
  }
  // Dry run: counts only
  const all = await db.outreachContact.findMany({ where: { list: "Music Industry", isActive: true, email: { not: null } }, select: { tags: true } });
  const conf = all.filter((c) => c.tags.includes(CONFIRMED_TAG)).length;
  console.log({ confirmados: conf, invitados: all.length - conf, total: all.length });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
