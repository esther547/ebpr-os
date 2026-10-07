import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { sendOutreach } from "@/lib/outreach";

/** TEMPORARY (Oct 7 2026): sends the Off The Record sample invitation to Esther. Removed once she has it. */
export async function GET(req: NextRequest) {
  const token = process.env.OUTREACH_SAMPLE_TOKEN;
  if (!token || req.headers.get("x-sample-token") !== token) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let flyer = null;
  try {
    const content = await readFile(path.join(process.cwd(), "public", "invites", "off-the-record-2026.png"));
    flyer = { filename: "off-the-record-2026.png", content, contentType: "image/png" };
  } catch {
    const res = await fetch(new URL("/invites/off-the-record-2026.png", req.nextUrl.origin));
    if (res.ok) flyer = { filename: "off-the-record-2026.png", content: Buffer.from(await res.arrayBuffer()), contentType: "image/png" };
  }
  const result = await sendOutreach({
    subject: "Invitación · OFF THE RECORD – Latin Music Week",
    body: `Hola [Nombre],

De parte de CMN Events y La Industria Inc., nos encantaría contar contigo en OFF THE RECORD, un encuentro privado de la industria musical en el marco de la Latin Music Week en Miami.

Es una noche para compartir con el equipo de CMN y conectar con colegas de la industria: DSPs, labels y distribuidoras, plataformas, managers, agentes y talento, aprovechando el momentum de los Latin Billboard.

Miércoles 21 de octubre
7:00 – 10:00 PM · Open bar de 7 a 9 PM
Midline Miami · 2221 NW Miami Ct, Miami, FL 33127

La invitación es personal y con cupo limitado. Confírmanos tu asistencia respondiendo a este correo e indicando si vienes con un acompañante.

¡Esperamos verte ahí!

Esther Beniflah
EB Public Relations · en nombre de CMN Events y La Industria Inc.`,
    flyer,
    testTo: "esther@ebmanagement.io",
    replyTo: "esther@ebmanagement.io",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
