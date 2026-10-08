/**
 * Press releases by email. The team (or the writer) forwards a release to press@ebmanagement.io; this reads
 * the unseen messages over IMAP, strips the forwarding header, quoting, the writer's branding (GMS) and
 * signatures, creates a PressRelease pending approval and emails the forwarder a test rendered exactly as
 * the journalists would get it. Distribution stays manual ("Send to journalists", Esther only).
 */
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { releaseHtml } from "@/lib/press-release-send";
import { PRESS_EXCLUDED_EMAILS } from "@/lib/permissions";

/** Words/brands never allowed in a release we distribute (the writer's own company). */
const STRIP_TERMS = ["GMS", "MS Agency", "GMS Agency"];
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || "https://os.ebpublicrelations.com";

export type InboxResult = {
  checked: number;
  created: { id: string; title: string; client: string | null; from: string; testTo: string | null }[];
  skipped: { from: string; subject: string; reason: string }[];
  error?: string;
};

function esc(v: string): string { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export function cleanSubject(subject: string): string {
  let s = (subject || "").trim();
  for (let i = 0; i < 5; i++) s = s.replace(/^\s*((fwd?|rv|re|tr|wg|aw|enc)\s*:|comunicado(\s+de\s+prensa)?\s*:|press\s+release\s*:|nota\s+de\s+prensa\s*:)\s*/i, "").trim();
  return s.replace(/\s+/g, " ");
}

/** Forwarded email text → clean release body. */
export function cleanForwardedRelease(raw: string, stripTerms: string[] = STRIP_TERMS, title = ""): string {
  const INVISIBLE = /[\u00ad\u034f\u200b\u200c\u200d\u2060\ufeff]/g;
  let lines = raw.replace(/\r\n?/g, "\n").replace(INVISIBLE, "").split("\n").map((l) => l.replace(/^(\s*>)+\s?/, "").replace(/\s+$/, ""));
  // Drop everything above the forwarded-message marker and the header block that follows it (ends at the first blank line).
  const marker = lines.findIndex((l) => /^-{2,}\s*(forwarded message|mensaje reenviado|original message|mensaje original)/i.test(l.trim()) || /^begin forwarded message:?$/i.test(l.trim()));
  if (marker >= 0) {
    lines = lines.slice(marker + 1);
    const blank = lines.findIndex((l) => !l.trim());
    if (blank >= 0 && blank <= 12) lines = lines.slice(blank + 1);
  } else {
    let i = 0; while (i < lines.length && /^\s*(from|de|date|fecha|subject|asunto|to|para|cc|sent|enviado)\s*:/i.test(lines[i])) i++;
    if (i > 1) lines = lines.slice(i);
  }
  const sig = lines.findIndex((l) => /^--\s*$/.test(l));
  if (sig >= 0) lines = lines.slice(0, sig);
  const termRe = new RegExp(`(^|[^\\p{L}])(${stripTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^\\p{L}]|$)`, "iu");
  const junk = (l: string) =>
    termRe.test(l) ||
    /(enviado desde mi|sent from my|unsubscribe|darse de baja|cancelar (la )?suscripci[oó]n|si no desea recibir|view (this|in) browser|ver en el navegador|comunicado distribuido por|distributed by)/i.test(l) ||
    /^\*?\s*(comunicado de prensa|press release|nota de prensa)\s*\*?$/i.test(l.trim()) ||
    /^<?https?:\/\/\S+>?$/i.test(l.trim()) ||
    /^[\w.+-]+@[\w.-]+\.\w+\s*(<[^>]*>)?$/.test(l.trim());
  // A distributor credit ("Comunicado distribuido por X para Y.") may wrap onto following lines: drop them up to the blank line.
  const kept: string[] = []; let skipping = false;
  for (const l of lines) {
    if (skipping) { if (!l.trim()) skipping = false; continue; }
    if (/(comunicado distribuido por|distributed by)/i.test(l)) { skipping = true; continue; }
    if (!junk(l)) kept.push(l);
  }
  lines = kept.map((l) => l.replace(/<https?:\/\/[^>\s]+>/g, "").replace(/\s{2,}/g, " ").replace(/^\*+|\*+$/g, "").trim());
  // Unwrap hard-wrapped paragraphs: consecutive lines form one paragraph when they read as flowing text.
  const paras: string[] = []; let block: string[] = [];
  const flush = () => { if (!block.length) return; const avg = block.reduce((a, l) => a + l.length, 0) / block.length; paras.push(block.length > 1 && avg > 45 ? block.join(" ").replace(/\s+/g, " ") : block.join("\n")); block = []; };
  for (const l of lines) { if (!l.trim()) flush(); else block.push(l); }
  flush();
  let out = paras.filter((p) => p.trim());
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  // The headline usually repeats the subject (sometimes with a word or two of difference): keep it once, as the title.
  if (title && out.length) {
    const a = new Set(norm(out[0]).split(" ")), b = new Set(norm(title).split(" "));
    const common = [...a].filter((w) => b.has(w)).length;
    if (common >= 0.8 * Math.max(a.size, b.size)) out = out.slice(1);
  }
  return out.join("\n\n").trim();
}

/** Pick the client the release is about, by name, if any. */
async function matchClient(text: string): Promise<{ id: string; name: string } | null> {
  const clients = await db.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  const hay = text.toLowerCase();
  let best: { id: string; name: string; score: number } | null = null;
  for (const c of clients) {
    const full = c.name.toLowerCase();
    let score = 0;
    if (hay.includes(full)) score = 10;
    else {
      const tokens = full.split(/[\s/·|,-]+/).filter((t) => t.length >= 4 && !/^(the|and|los|las|del|de|la|el|grupo|music|media)$/.test(t));
      const hits = tokens.filter((t) => hay.includes(t)).length;
      if (tokens.length && hits >= Math.min(2, tokens.length)) score = hits;
    }
    if (score && (!best || score > best.score)) best = { ...c, score };
  }
  return best ? { id: best.id, name: best.name } : null;
}

async function allowedSenders(): Promise<Set<string>> {
  const users = await db.user.findMany({ where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } }, select: { email: true } });
  const set = new Set(users.map((u) => u.email.toLowerCase()).filter((e) => !PRESS_EXCLUDED_EMAILS.includes(e)));
  for (const e of (process.env.PRESS_INBOX_SENDERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) set.add(e);
  return set;
}

/** Photo URLs in the email body (hosted by the writer's mailer), skipping trackers and logos. */
export function extractImages(html: string | null): string[] {
  if (!html) return [];
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]; const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1]; if (!src || !/^https?:\/\//.test(src)) continue;
    if (/list-manage|open\.php|track|pixel|\.gif(\?|$)/i.test(src)) continue;
    const w = Number(tag.match(/\swidth=["']?(\d+)/i)?.[1] ?? 0);
    if (w && w < 300) continue; // logos / icons
    if (!out.includes(src)) out.push(src.replace(/&amp;/g, "&"));
  }
  return out.slice(0, 8);
}

export function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|h\d|li)>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function testEmailHtml(release: { id: string; title: string; content: string; images?: string[] }, clientName: string | null, from: string, imageCount: number): string {
  const note = `<div style="max-width:640px;margin:0 auto 14px;background:#fff7e6;border:1px solid #f5d08a;border-radius:8px;padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#5b4400">
  <strong>PRUEBA · así lo recibirían los medios.</strong><br>Comunicado recibido en press@ de ${esc(from)}${clientName ? ` · cliente detectado: <strong>${esc(clientName)}</strong>` : " · sin cliente asociado"}.${imageCount ? `<br>El correo original traía ${imageCount} imagen(es); por ahora el comunicado sale solo con texto.` : ""}
  ${release.images?.length ? `<br>Lleva ${release.images.length} foto(s) del comunicado original.` : ""}<br><br>Para difundirlo a la base de Medios: <a href="${PORTAL_URL}/press-releases" style="color:#0a0a0a;font-weight:600">Press Releases</a> → «${esc(release.title)}» → <strong>Send to journalists</strong>. Ahí mismo puedes editar el texto o el título antes de enviarlo.
</div>`;
  return releaseHtml(release.title, release.content, clientName ?? "EB Public Relations", release.images ?? []).replace('<div style="max-width:640px;margin:0 auto;background:#fff">', `${note}<div style="max-width:640px;margin:0 auto;background:#fff">`);
}

/** Read press@ and turn each forwarded release into a pending PressRelease + a test email. */
/** Diagnostic: raw text of the latest messages from known senders (seen or not), nothing is created. */
export async function peekPressInbox(limit = 3): Promise<{ from: string; subject: string; date: string | null; text: string; html: string | null }[] | { error: string }> {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { error: "mail not configured" };
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 40000 });
  try {
    const allowed = await allowedSenders();
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const froms = [...allowed].map((a) => ({ from: a }));
      const uids = (await client.search({ since: new Date(Date.now() - 14 * 86400000), ...(froms.length === 1 ? froms[0] : { or: froms }) }, { uid: true })) || [];
      const out: { from: string; subject: string; date: string | null; text: string; html: string | null }[] = [];
      for (const uid of uids.slice(-limit)) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const mail = await simpleParser(msg.source);
        out.push({ from: mail.from?.value?.[0]?.address ?? "", subject: mail.subject ?? "", date: mail.date?.toISOString() ?? null, text: mail.text ?? "", html: mail.html ? String(mail.html) : null });
      }
      return out;
    } finally { lock.release(); await client.logout(); }
  } catch (err) { try { client.close(); } catch { /* ignore */ } return { error: err instanceof Error ? err.message : String(err) }; }
}

export async function processPressInbox(): Promise<InboxResult> {
  const result: InboxResult = { checked: 0, created: [], skipped: [] };
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { ...result, error: "El correo no está configurado (GMAIL_USER / GMAIL_APP_PASSWORD)." };
  const t0 = Date.now(); const log = (m: string) => console.log(`[press-inbox] +${Date.now() - t0}ms ${m}`);
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 40000 });
  const timeout = new Promise<InboxResult>((resolve) => setTimeout(() => resolve({ ...result, error: "IMAP tardó demasiado (más de 45 s). Revisa que IMAP esté activo en press@ y vuelve a intentar." }), 45000));
  const work = (async (): Promise<InboxResult> => {
    const allowed = await allowedSenders();
    log(`connecting as ${user}; ${allowed.size} allowed senders`);
    await client.connect();
    log("connected");
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Server-side search: unseen, recent, from a known sender (cheap even on a huge inbox).
      const since = new Date(Date.now() - 14 * 86400000);
      const froms = [...allowed].map((a) => ({ from: a }));
      const orTree = froms.length === 1 ? froms[0] : { or: froms };
      const uids = (await client.search({ seen: false, since, ...orTree }, { uid: true })) || [];
      log(`search → ${uids.length} message(s)`);
      const pick = uids.slice(-10);
      const messages: { uid: number; mail: ParsedMail }[] = [];
      for (const uid of pick) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (msg && msg.source) messages.push({ uid, mail: await simpleParser(msg.source) });
      }
      log(`fetched ${messages.length}`);
      result.checked = messages.length;
      const admin = await db.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true, email: true }, orderBy: { createdAt: "asc" } });
      for (const { uid, mail } of messages) {
        const from = (mail.from?.value?.[0]?.address ?? "").toLowerCase();
        const subject = mail.subject ?? "";
        const markSeen = () => client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true }).catch(() => null);
        if (!allowed.has(from)) { result.skipped.push({ from, subject, reason: `remitente no autorizado (${from})` }); await markSeen(); continue; }
        const html = mail.html ? String(mail.html) : null;
        const text = (mail.text ?? "").trim() || (html ? htmlToText(html) : "");
        const imageUrls = extractImages(html);
        let title = cleanSubject(subject);
        let content = cleanForwardedRelease(text, STRIP_TERMS, title);
        if (!content) { result.skipped.push({ from, subject, reason: "correo sin texto" }); await markSeen(); continue; }
        const firstLine = content.split("\n")[0].trim();
        if ((!title || /^(comunicado|press release|nota de prensa|noticia)$/i.test(title)) && firstLine.length <= 140) { title = firstLine; content = content.split("\n").slice(1).join("\n").trim(); }
        if (!title) title = "Comunicado sin título";
        const dup = await db.pressRelease.findFirst({ where: { sourceSubject: subject, sourceFrom: from, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { id: true } });
        if (dup) { result.skipped.push({ from, subject, reason: "ya se había recibido este mismo correo" }); await markSeen(); continue; }
        const matched = await matchClient(`${title}\n${content}`);
        const sender = await db.user.findFirst({ where: { email: from }, select: { id: true, email: true } });
        const creatorId = sender?.id ?? admin?.id;
        if (!creatorId) { result.skipped.push({ from, subject, reason: "no hay usuario para registrarlo" }); continue; }
        const release = await db.pressRelease.create({ data: { title, content, status: "PENDING_APPROVAL", clientId: matched?.id ?? null, createdById: creatorId, sourceFrom: from, sourceSubject: subject, sourceReceivedAt: mail.date ?? new Date(), sourceRaw: (html ?? text).slice(0, 400_000), images: imageUrls, tags: [] }, select: { id: true, title: true, content: true, images: true } });
        const images = (mail.attachments ?? []).filter((a) => /^image\//.test(a.contentType)).length + imageUrls.length;
        let testTo: string | null = null;
        if (isEmailConfigured()) {
          testTo = sender?.email ?? admin?.email ?? null;
          if (testTo) {
            const ok = await sendEmail({ to: testTo, subject: `[PRUEBA] ${release.title}`, html: testEmailHtml(release, matched?.name ?? null, from, images), text: `PRUEBA · comunicado recibido de ${from}\n\n${release.title}\n\n${release.content}\n\nPara difundirlo: ${PORTAL_URL}/press-releases` });
            if (ok) await db.pressRelease.update({ where: { id: release.id }, data: { testSentAt: new Date() } });
            else testTo = null;
          }
        }
        result.created.push({ id: release.id, title: release.title, client: matched?.name ?? null, from, testTo });
        await markSeen();
        log(`created "${release.title}" (test → ${testTo ?? "no"})`);
      }
    } finally { lock.release(); }
    await client.logout();
    log("done");
    return result;
  })().catch((err) => { console.error("[press-inbox]", err); return { ...result, error: err instanceof Error ? err.message : String(err) }; });
  const out = await Promise.race([work, timeout]);
  try { client.close(); } catch { /* ignore */ }
  return out;
}

/** Re-clean a release from the email text we stored and send the test again (after improving the cleaner). */
export async function recleanRelease(id: string, raw?: string): Promise<{ ok: boolean; error?: string; title?: string; testTo?: string | null }> {
  const r = await db.pressRelease.findUnique({ where: { id }, select: { id: true, sourceRaw: true, sourceSubject: true, sourceFrom: true, client: { select: { name: true } }, createdBy: { select: { email: true } } } });
  if (!r) return { ok: false, error: "release not found" };
  const stored = raw ?? r.sourceRaw ?? "";
  if (!stored) return { ok: false, error: "no raw text stored" };
  const isHtml = /<(html|body|div|table)[\s>]/i.test(stored);
  const text = isHtml ? htmlToText(stored) : stored;
  const images = isHtml ? extractImages(stored) : undefined;
  const title = cleanSubject(r.sourceSubject ?? "") || "Comunicado";
  const content = cleanForwardedRelease(text, STRIP_TERMS, title);
  const release = await db.pressRelease.update({ where: { id }, data: { title, content, sourceRaw: raw ?? r.sourceRaw, ...(images ? { images } : {}) }, select: { id: true, title: true, content: true, images: true } });
  const testTo = r.createdBy.email;
  const ok = isEmailConfigured() ? await sendEmail({ to: testTo, subject: `[PRUEBA] ${release.title}`, html: testEmailHtml(release, r.client?.name ?? null, r.sourceFrom ?? "", 0), text: `${release.title}\n\n${release.content}` }) : false;
  if (ok) await db.pressRelease.update({ where: { id }, data: { testSentAt: new Date() } });
  return { ok: true, title, testTo: ok ? testTo : null };
}
