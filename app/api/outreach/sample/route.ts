import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { sendOutreach } from "@/lib/outreach";

/** TEMPORARY (Oct 8 2026): Esther's third Off The Record sample (her text, no header band). Removed after. */
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
    subject: "OFF THE RECORD | Latin Music Week",
    body: `CMN y La Industria Inc. tienen el placer de invitarte a OFF THE RECORD, un encuentro exclusivo para profesionales de la industria musical y del entretenimiento, en el marco de Latin Music Week.

Fecha: Miércoles, 21 de octubre
Hora: 7:00 p. m. – 10:00 p. m.
Open Bar: 7:00 p. m. – 9:00 p. m.
Lugar: Midline Miami
Dirección: 2221 NW Miami Ct, Miami, FL 33127

Esta invitación es personal e intransferible y el evento cuenta con cupos limitados.

Confirma tu asistencia respondiendo a este correo e indicando si asistirás con un acompañante.

¡Te esperamos!

Cardenas Marketing Network (CMN) & La Industria Inc.`,
    flyer,
    brand: { fromName: "OFF THE RECORD", header: "", footer: "" },
    testTo: "esther@ebmanagement.io",
    replyTo: "esther@ebmanagement.io",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
