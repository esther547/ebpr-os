import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { secretInfo, setStoredSecret } from "@/lib/app-secrets";
import { sendEmail, verifyMailPassword } from "@/lib/email";

export const dynamic = "force-dynamic";

/** GET — where the sender password comes from (never the value). */
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user || !canManageUsers(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const info = await secretInfo("GMAIL_APP_PASSWORD");
  return NextResponse.json({ sender: process.env.GMAIL_USER ?? null, ...info });
}

/** POST { appPassword } — check it against Gmail, save it encrypted, send the admin a test email. */
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user || !canManageUsers(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ appPassword: z.string().min(8).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pega la contraseña de aplicación (16 caracteres)" }, { status: 400 });
  const pass = parsed.data.appPassword.replace(/\s+/g, "");
  const check = await verifyMailPassword(pass);
  if (!check.ok) return NextResponse.json({ error: `Gmail no la aceptó: ${check.error ?? "revisa que sea una contraseña de aplicación de " + (process.env.GMAIL_USER ?? "la cuenta")}` }, { status: 400 });
  await setStoredSecret("GMAIL_APP_PASSWORD", pass, user.id);
  const test = await sendEmail({ to: user.email, subject: "EBPR OS · correo activo de nuevo", html: `<p>La cuenta <strong>${process.env.GMAIL_USER}</strong> vuelve a enviar correos desde el portal. Guardado por ${user.name}.</p>`, text: `La cuenta ${process.env.GMAIL_USER} vuelve a enviar correos desde el portal.` });
  return NextResponse.json({ ok: true, testSent: test, sender: process.env.GMAIL_USER });
}
