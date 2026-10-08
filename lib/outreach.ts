/**
 * Outreach database ("Music Industry"): Esther's private contact list of managers, labels, promoters,
 * venues, brands and DSPs, and the invitations she sends them from the portal (BCC batches from press@).
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";

export const DEFAULT_LIST = "Music Industry";
const BCC_BATCH = 50;
const MAX_PER_SEND = 1500;

export function outreachWhere(opts: { list?: string; search?: string | null; category?: string | null; categories?: string[]; tags?: string[]; includeInactive?: boolean; withEmail?: boolean }): Prisma.OutreachContactWhereInput {
  const where: Prisma.OutreachContactWhereInput = { list: opts.list ?? DEFAULT_LIST };
  if (!opts.includeInactive) where.isActive = true;
  if (opts.withEmail) where.email = { not: null };
  const search = opts.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { role: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }
  const category = opts.category?.trim();
  if (category) where.category = { equals: category, mode: "insensitive" };
  const categories = (opts.categories ?? []).map((c) => c.trim()).filter(Boolean);
  const tags = (opts.tags ?? []).map((t) => t.trim()).filter(Boolean);
  if (categories.length || tags.length) {
    const or: Prisma.OutreachContactWhereInput[] = [];
    if (categories.length) or.push({ category: { in: categories, mode: "insensitive" } });
    if (tags.length) or.push({ tags: { hasSome: tags } });
    where.AND = [{ OR: or }];
  }
  return where;
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text → simple branded HTML (blank line = paragraph; URLs become links). */
export type Flyer = { filename: string; content: Buffer; contentType: string };

export type Brand = { fromName?: string; header?: string; footer?: string };

export function invitationHtml(subject: string, body: string, flyer?: Flyer | null, brand: Brand = {}): string {
  const header = (brand.header || "EB PUBLIC RELATIONS").trim();
  const footer = brand.footer === undefined ? "EB Public Relations · press@ebmanagement.io" : brand.footer.trim();
  const linkify = (t: string) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0a0a0a">$1</a>');
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${linkify(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:640px;margin:0 auto;background:#fff">
  <div style="background:#0a0a0a;color:#fff;padding:22px 28px"><div style="font-size:16px;font-weight:600;letter-spacing:2px">${esc(header)}</div></div>
  ${flyer ? `<img src="cid:flyer" alt="${esc(subject)}" style="display:block;width:100%;height:auto">` : ""}
  <div style="padding:26px 28px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 18px">${esc(subject)}</h1>
    ${paragraphs}
    ${footer ? `<p style="margin-top:22px;font-size:12px;color:#6b7280">${esc(footer)}</p>` : ""}
  </div>
</div></body></html>`;
}

export type OutreachSendResult = { ok: true; recipients: number; batches: number; skipped: number } | { ok: false; error: string };

/** Send one invitation to every active contact matching the filters (or to `testTo` only). */
export async function sendOutreach(opts: { list?: string; subject: string; body: string; categories?: string[]; tags?: string[]; replyTo?: string; testTo?: string; sentById?: string; flyer?: Flyer | null; brand?: Brand }): Promise<OutreachSendResult> {
  if (!isEmailConfigured()) return { ok: false, error: "El correo no está configurado (GMAIL_USER / GMAIL_APP_PASSWORD)." };
  const brand = opts.brand ?? {};
  const html = invitationHtml(opts.subject, opts.body, opts.flyer, brand);
  const attachments = opts.flyer ? [{ filename: opts.flyer.filename, content: opts.flyer.content, contentType: opts.flyer.contentType, cid: "flyer" }] : undefined;
  const text = `${opts.body}${brand.footer === undefined ? "\n\nEB Public Relations · press@ebmanagement.io" : brand.footer ? `\n\n${brand.footer}` : ""}`;
  if (opts.testTo) {
    const ok = await sendEmail({ to: opts.testTo, replyTo: opts.replyTo, subject: `[Prueba] ${opts.subject}`, html, text, attachments, fromName: brand.fromName });
    return ok ? { ok: true, recipients: 1, batches: 1, skipped: 0 } : { ok: false, error: "Gmail rechazó la prueba." };
  }
  const contacts = await db.outreachContact.findMany({ where: outreachWhere({ list: opts.list, categories: opts.categories, tags: opts.tags, withEmail: true }), select: { email: true }, orderBy: { name: "asc" } });
  const emails = [...new Set(contacts.map((c) => (c.email ?? "").trim().toLowerCase()).filter((e) => /\S+@\S+\.\S+/.test(e)))];
  if (!emails.length) return { ok: false, error: "No hay contactos activos que coincidan con el filtro." };
  const send = emails.slice(0, MAX_PER_SEND);
  let sent = 0, batches = 0;
  for (let i = 0; i < send.length; i += BCC_BATCH) {
    const bcc = send.slice(i, i + BCC_BATCH);
    const ok = await sendEmail({ to: process.env.GMAIL_USER!, bcc, replyTo: opts.replyTo, subject: opts.subject, html, text, attachments, fromName: brand.fromName });
    batches++;
    if (ok) sent += bcc.length; else console.error(`[outreach] batch ${batches} failed (${bcc.length})`);
    if (i + BCC_BATCH < send.length) await new Promise((r) => setTimeout(r, 400));
  }
  if (!sent) return { ok: false, error: "Gmail rechazó el envío. Revisa GMAIL_USER / GMAIL_APP_PASSWORD." };
  await db.outreachSend.create({ data: { list: opts.list ?? DEFAULT_LIST, subject: opts.subject, body: opts.body, categories: opts.categories ?? [], tags: opts.tags ?? [], recipientCount: sent, sentById: opts.sentById ?? null } });
  return { ok: true, recipients: sent, batches, skipped: emails.length - send.length };
}
