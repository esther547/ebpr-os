import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { sendOutreach } from "@/lib/outreach";

/** TEMPORARY (Oct 8 2026): sends Esther the corrected Off The Record sample (CMN & La Industria as sender). Removed after. */
export async function GET(req: NextRequest) {
  const token = process.env.OUTREACH_SAMPLE_TOKEN;
  if (!token || req.headers.get("x-sample-token") !== token) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let flyer = null;
  try {
    flyer = { filename: "off-the-record-2026.png", content: await readFile(path.join(process.cwd(), "public", "invites", "off-the-record-2026.png")), contentType: "image/png" };
  } catch {
    const res = await fetch(new URL("/invites/off-the-record-2026.png", req.nextUrl.origin));
    if (res.ok) flyer = { filename: "off-the-record-2026.png", content: Buffer.from(await res.arrayBuffer()), contentType: "image/png" };
  }
  const result = await sendOutreach({
    subject: "Invitación · OFF THE RECORD – Latin Music Week",
    body: `CMN Events y La Industria Inc. tienen el gusto de invitarte a OFF THE RECORD, un encuentro privado de la industria musical en el marco de la Latin Music Week en Miami.

Una noche para reunir a DSPs, labels, distribuidoras, plataformas, managers, agentes y talento, aprovechando el momentum de los Latin Billboard.

Miércoles 21 de octubre
7:00 – 10:00 PM · Open bar de 7 a 9 PM
Midline Miami · 2221 NW Miami Ct, Miami, FL 33127

Invitación personal e intransferible, con cupo limitado. Confirma tu asistencia respondiendo a este correo e indica si asistirás con un acompañante.

Te esperamos.

CMN Events · La Industria Inc.`,
    flyer,
    brand: { fromName: "CMN Events & La Industria Inc.", header: "CMN EVENTS × LA INDUSTRIA INC.", footer: "OFF THE RECORD · Latin Music Week · Miami · RSVP respondiendo a este correo" },
    testTo: "esther@ebmanagement.io",
    replyTo: "esther@ebmanagement.io",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
