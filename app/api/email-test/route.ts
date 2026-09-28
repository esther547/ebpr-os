import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** GET /api/email-test — SUPER_ADMIN only: sends a test email to the signed-in admin. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: false, error: "GMAIL_USER / GMAIL_APP_PASSWORD no están configurados en Vercel." });
  }
  const sent = await sendEmail({
    to: user.email,
    subject: "EBPR OS · correo de prueba",
    html: `<p>Hola ${user.name.split(" ")[0]},</p><p>Este es el correo de prueba de EBPR OS. Si lo ves, el envío desde <strong>${process.env.GMAIL_USER}</strong> funciona.</p><p>Desde ahora saldrán por aquí los recordatorios de pitch (lunes y jueves), los briefs a Michel y los avisos de comunicado entregado.</p>`,
    text: "Correo de prueba de EBPR OS. El envío funciona.",
  });
  return NextResponse.json({ ok: sent, to: user.email, from: process.env.GMAIL_USER, message: sent ? "Enviado. Revisa tu bandeja (y spam la primera vez)." : "Gmail rechazó el envío: revisa el App password (sin espacios) y que GMAIL_USER sea press@ebmanagement.io." });
}
