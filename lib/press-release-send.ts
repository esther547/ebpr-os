/**
 * Press release distribution: emails the release to every active journalist whose beat or
 * tags match the release tags (all active journalists when untagged), in BCC batches from
 * the Gmail sender (press@ebmanagement.io). Returns how many addresses were actually sent.
 */
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { journalistWhere } from "@/app/api/journalists/_shared";

const BCC_BATCH = 50; // Gmail allows ~100 recipients per message; stay well under it
const MAX_PER_SEND = 1500; // Workspace daily cap is 2,000; keep headroom for the team's own mail

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain-text release → simple HTML paragraphs (blank line = new paragraph). */
export function releaseHtml(title: string, content: string, clientName: string): string {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:640px;margin:0 auto;background:#fff">
  <div style="background:#0a0a0a;color:#fff;padding:22px 28px"><div style="font-size:16px;font-weight:600;letter-spacing:2px">EB PUBLIC RELATIONS</div><div style="font-size:12px;color:#999;margin-top:4px">Press release · ${esc(clientName)}</div></div>
  <div style="padding:26px 28px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 18px">${esc(title)}</h1>
    ${paragraphs}
    <p style="margin-top:22px;font-size:12px;color:#6b7280">Contacto de prensa: EB Public Relations · press@ebmanagement.io</p>
  </div>
</div></body></html>`;
}

export type DistributionResult =
  | { ok: true; recipients: number; batches: number; skipped: number }
  | { ok: false; error: string };

export async function distributePressRelease(releaseId: string): Promise<DistributionResult> {
  if (!isEmailConfigured()) return { ok: false, error: "El correo no está configurado (GMAIL_USER / GMAIL_APP_PASSWORD)." };
  const release = await db.pressRelease.findUnique({
    where: { id: releaseId },
    select: { title: true, content: true, tags: true, client: { select: { name: true } } },
  });
  if (!release) return { ok: false, error: "Press release no encontrado." };

  const journalists = await db.journalist.findMany({
    where: journalistWhere({ tags: release.tags }),
    select: { email: true },
    orderBy: { name: "asc" },
  });
  const emails = [...new Set(journalists.map((j) => j.email.trim().toLowerCase()).filter((e) => /\S+@\S+\.\S+/.test(e)))];
  if (emails.length === 0) return { ok: false, error: "No hay periodistas activos que coincidan con las etiquetas del comunicado." };
  const send = emails.slice(0, MAX_PER_SEND);
  const skipped = emails.length - send.length;

  const html = releaseHtml(release.title, release.content, release.client?.name ?? "EB Public Relations");
  const text = `${release.title}\n\n${release.content}\n\nContacto de prensa: EB Public Relations · press@ebmanagement.io`;
  let sent = 0;
  let batches = 0;
  for (let i = 0; i < send.length; i += BCC_BATCH) {
    const bcc = send.slice(i, i + BCC_BATCH);
    const ok = await sendEmail({ to: process.env.GMAIL_USER!, bcc, subject: release.title, html, text });
    batches++;
    if (ok) sent += bcc.length;
    else console.error(`[press-release] batch ${batches} failed (${bcc.length} recipients)`);
    if (i + BCC_BATCH < send.length) await new Promise((r) => setTimeout(r, 400));
  }
  if (sent === 0) return { ok: false, error: "Gmail rechazó el envío. Revisa GMAIL_USER / GMAIL_APP_PASSWORD." };
  return { ok: true, recipients: sent, batches, skipped };
}
