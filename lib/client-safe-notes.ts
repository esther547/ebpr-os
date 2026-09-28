/**
 * Pauta notes reach two very different audiences: the client (portal agenda + Google Doc
 * agenda) and the team/runners. Contacts (producers' phones, emails, "CONTACTO X …"),
 * runner logistics and post-event notes must NEVER reach the client (Esther, Sept 28 2026).
 *
 * `internalNotes` is the home for that; this module is the safety net for anything typed
 * into the client-visible `notes` field by mistake: lines that look like contact info or
 * internal chatter are moved to internal on save, and filtered again on render.
 */

const PHONE = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]?\d{4}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const INTERNAL_WORDS = /\bcontacto\b|\bcontact\b|post-event|no requiere runner|\bproductor[a]?\b|\bproducer\b|\bbooker\b|\bwhatsapp\b|\bcel(ular)?\b|\btel(éfono|efono)?\b/i;

export function isInternalNoteLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Links to publications are client-facing: words/digits inside a URL don't count.
  const withoutUrls = t.replace(/https?:\/\/\S+/gi, " ");
  return PHONE.test(withoutUrls) || EMAIL.test(withoutUrls) || INTERNAL_WORDS.test(withoutUrls);
}

/** Split free text into the part a client may see and the part that stays internal. */
export function splitClientNotes(notes: string | null | undefined): { client: string | null; internal: string | null } {
  if (!notes) return { client: null, internal: null };
  const client: string[] = [];
  const internal: string[] = [];
  for (const line of notes.split(/\r?\n/)) (isInternalNoteLine(line) ? internal : client).push(line);
  const trim = (lines: string[]) => lines.join("\n").trim() || null;
  return { client: trim(client), internal: trim(internal) };
}

/** What a client may see of a pauta's notes (render-time filter, second line of defense). */
export function clientSafeNotes(notes: string | null | undefined): string | null {
  return splitClientNotes(notes).client;
}

/** Merge a new internal fragment into existing internal notes without duplicating it. */
export function mergeInternalNotes(existing: string | null | undefined, extra: string | null | undefined): string | null {
  const a = (existing ?? "").trim();
  const b = (extra ?? "").trim();
  if (!b) return a || null;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n${b}`;
}
