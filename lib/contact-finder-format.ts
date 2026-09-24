// Contact finder ("Contacto / fuente") — pure pieces shared by the server, the
// browser and the parser test: the system prompt, the user prompt, the tolerant
// parser of Claude's final ```json block and the formatter that turns the
// result into the internal `contactNotes` text.
// No Prisma / SDK / React imports here.
//
// INTERNAL ONLY: contact notes are never shown in the client portal and are
// never copied into Deliverable.notes (portal-visible).

import { z } from "zod";

// ─── Model / tool ────────────────────────────────────────

export const CONTACT_FINDER_MODEL = "claude-opus-5";
export const CONTACT_WEB_SEARCH_MAX_USES = 6;

/** Max length of a saved contact note (manual or AI). */
export const CONTACT_NOTES_MAX = 8000;

export const CONTACT_SOURCES = ["TEAM", "AI"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

// ─── Candidate shape ─────────────────────────────────────

export const CONTACT_CHANNELS = ["email", "instagram", "linkedin", "form", "phone", "other"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_CONFIDENCES = ["alta", "media", "baja"] as const;
export type ContactConfidence = (typeof CONTACT_CONFIDENCES)[number];

export const CHANNEL_LABEL: Record<ContactChannel, string> = {
  email: "email",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  form: "formulario",
  phone: "teléfono",
  other: "otro",
};

/** A row of the internal Journalist table that matches the target. */
export type InternalContact = {
  id: string;
  name: string;
  outlet: string | null;
  beat: string | null;
  email: string;
  phone: string | null;
  city: string | null;
};

export type FindContactsInput = {
  clientName: string;
  clientIndustry?: string | null;
  targetTitle: string;
  targetName?: string | null;
  category: string;
  notes?: string | null;
  city?: string | null;
};

// ─── Prompt ──────────────────────────────────────────────

export const CONTACT_FINDER_SYSTEM_PROMPT = `Eres una investigadora senior de relaciones públicas en EB Public Relations, una agencia de PR en Miami especializada en el mercado latino de Estados Unidos y Latinoamérica. Tu trabajo es encontrar la puerta de entrada para que un cliente de la agencia consiga una entrevista, una aparición, una acreditación o una alianza.

Vas a recibir UN objetivo del equipo (un medio, programa, podcast, creador, marca o evento) y el cliente para quien lo queremos. Usa la búsqueda web para identificar a quién contactar y por qué canal:
- Programas de TV, radio y podcasts: booker, productor(a) o productor(a) de segmento, relaciones con talento.
- Revistas y medios digitales: editor(a) de la sección que corresponde y periodistas con notas recientes sobre el tema.
- Eventos, premios y galas: la agencia de PR o de comunicaciones que maneja el evento, la oficina de prensa y el formulario de acreditación de medios o de solicitud de talento.
- Marcas: la agencia de PR o de influencer marketing de la marca y su equipo de comunicaciones o alianzas.
- Siempre que exista: el correo de prensa publicado, la página oficial de prensa o el formulario oficial de solicitudes de medios.

Cómo investigar:
- Prioriza fuentes oficiales (sitio del medio o del evento, página de prensa, masthead o créditos), perfiles públicos de LinkedIn o Instagram donde la persona declara su cargo, y firmas o créditos recientes (últimos 12 a 18 meses).
- Cita la URL exacta donde encontraste cada dato.
- NUNCA inventes nombres, cargos, correos, teléfonos ni usuarios: incluye solo lo que aparece en una fuente. No deduzcas correos por patrón (por ejemplo nombre.apellido@medio.com).
- Si no encuentras a una persona concreta, dilo con claridad y da el canal oficial genérico (correo de prensa, formulario, cuenta oficial) con su fuente.
- Si un dato puede estar desactualizado (la persona cambió de cargo, la nota es antigua), baja la confianza y explícalo.
- Los contactos que ya tenemos en nuestra base interna no hace falta repetirlos como candidatos.
- Máximo 6 candidatos, ordenados del más útil al menos útil.

Formato de la respuesta: puedes escribir notas breves mientras investigas, pero termina SIEMPRE con UN solo bloque \`\`\`json, sin nada después, con esta forma:
\`\`\`json
{
  "candidates": [
    {
      "name": "Nombre y apellido, o null si es un canal genérico",
      "role": "cargo o función",
      "organization": "medio, programa, agencia o evento",
      "channel": "email | instagram | linkedin | form | phone | other",
      "handle": "correo, URL o usuario tal como aparece en la fuente, o null",
      "sourceUrl": "URL donde lo encontraste",
      "confidence": "alta | media | baja",
      "howToApproach": "1 o 2 oraciones en español: cómo abordarlo para este cliente"
    }
  ],
  "summary": "2 o 3 oraciones en español: la mejor ruta de entrada y por qué",
  "caveats": "lo que no se pudo confirmar o hay que verificar"
}
\`\`\`
Si no encontraste nada específico, deja "candidates" con el canal oficial genérico (o vacío) y explícalo en "summary". Escribe en español neutro, directo y profesional.`;

const CATEGORY_ES: Record<string, string> = {
  MEDIA_TARGET: "medio (prensa, TV, radio o podcast)",
  INFLUENCER: "creador de contenido / colaboración",
  EVENT: "evento, premio o alfombra roja",
  BRAND_OPPORTUNITY: "marca / alianza",
  POSITIONING: "posicionamiento",
  SOCIAL_MEDIA: "redes sociales",
  PRESS_RELEASE: "comunicado de prensa",
  OTHER: "general",
};

function line(v: string | null | undefined, max = 600): string {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/**
 * The user turn. Internal contacts go in by name/outlet/beat only (their
 * emails and phones never leave the app).
 */
export function buildContactFinderUserPrompt(
  input: FindContactsInput,
  internal: InternalContact[],
  todayLabel: string
): string {
  const rows = [
    `Cliente: ${line(input.clientName, 120)}${input.clientIndustry ? ` (${line(input.clientIndustry, 120)})` : ""}`,
    `Objetivo: ${line(input.targetTitle, 300)}`,
    input.targetName && line(input.targetName) !== line(input.targetTitle) ? `Nombre del medio / evento / marca: ${line(input.targetName, 200)}` : "",
    `Tipo: ${CATEGORY_ES[input.category] ?? line(input.category, 60).toLowerCase()}`,
    input.city ? `Ciudad o lugar: ${line(input.city, 120)}` : "",
    input.notes ? `Notas del equipo: ${line(input.notes, 1200)}` : "",
  ].filter(Boolean);

  const known = internal.length
    ? internal.map((c) => `- ${[c.name, c.outlet, c.beat].filter(Boolean).join(" · ")}`).join("\n")
    : "Ninguno.";

  return `Hoy es ${todayLabel} (hora de Miami).

<objetivo>
${rows.join("\n")}
</objetivo>

<contactos_internos>
${known}
</contactos_internos>

Investiga quién podría abrirnos la puerta para lograr este objetivo para el cliente y termina con el bloque json.`;
}

// ─── Parser ──────────────────────────────────────────────

export class ContactFinderParseError extends Error {}

const clip = (max: number) => (v: string) => (v.length > max ? v.slice(0, max - 1).trimEnd() + "…" : v);

/** A string or null ("null", "", "n/a" become null). */
const optText = (max: number) =>
  z
    .unknown()
    .transform((v) => {
      if (typeof v !== "string" && typeof v !== "number") return null;
      const s = String(v).replace(/\s+/g, " ").trim();
      if (!s || /^(null|none|n\/a|ninguno|-)$/i.test(s)) return null;
      return clip(max)(s);
    });

const CONFIDENCE_ALIASES: Record<string, ContactConfidence> = {
  alta: "alta",
  high: "alta",
  media: "media",
  medium: "media",
  baja: "baja",
  low: "baja",
};

const candidateSchema = z
  .object({
    name: optText(160),
    role: optText(200),
    organization: optText(200),
    channel: z.unknown().transform((v): ContactChannel => {
      const c = typeof v === "string" ? v.trim().toLowerCase() : "";
      if ((CONTACT_CHANNELS as readonly string[]).includes(c)) return c as ContactChannel;
      if (c === "correo" || c === "mail" || c === "e-mail") return "email";
      if (c === "formulario" || c === "web form") return "form";
      if (c === "teléfono" || c === "telefono") return "phone";
      if (c === "ig") return "instagram";
      return "other";
    }),
    handle: optText(300),
    sourceUrl: optText(500),
    confidence: z.unknown().transform((v): ContactConfidence => {
      const c = typeof v === "string" ? v.trim().toLowerCase() : "";
      return CONFIDENCE_ALIASES[c] ?? "baja";
    }),
    howToApproach: optText(600),
  })
  .passthrough()
  .transform(({ name, role, organization, channel, handle, sourceUrl, confidence, howToApproach }) => ({
    name,
    role,
    organization,
    channel,
    handle,
    sourceUrl,
    confidence,
    howToApproach,
  }));

export type ContactCandidate = z.infer<typeof candidateSchema>;

const resultSchema = z
  .object({
    candidates: z
      .unknown()
      .transform((v) => (Array.isArray(v) ? v : []))
      .pipe(z.array(z.unknown())),
    summary: optText(1200),
    caveats: optText(1200),
  })
  .passthrough();

export type ContactFinderResult = {
  candidates: ContactCandidate[];
  summary: string | null;
  caveats: string | null;
};

/**
 * The text of the LAST ```json fence (or, failing that, the last ``` fence,
 * or the outermost {...}) in `text`. Returns null when there is none.
 */
export function extractJsonFence(text: string): string | null {
  const lower = text.toLowerCase();
  let start = lower.lastIndexOf("```json");
  let open = 7;
  if (start === -1) {
    // Last opening fence: the second-to-last ``` when the fences are balanced.
    const marks: number[] = [];
    for (let i = text.indexOf("```"); i !== -1; i = text.indexOf("```", i + 3)) marks.push(i);
    if (marks.length >= 2) {
      start = marks[marks.length % 2 === 0 ? marks.length - 2 : marks.length - 1];
      open = 3;
    }
  }
  if (start !== -1) {
    const bodyStart = start + open;
    const end = text.indexOf("```", bodyStart);
    const body = (end === -1 ? text.slice(bodyStart) : text.slice(bodyStart, end)).trim();
    if (body) return body;
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return first !== -1 && last > first ? text.slice(first, last + 1) : null;
}

/**
 * Validate the JSON block of Claude's final answer. Tolerant: unknown fields
 * are ignored, a missing/invalid `candidates` becomes [], unknown channel ->
 * "other", unknown confidence -> "baja"; candidates with no name, role,
 * organization or handle are dropped. At most 8 candidates.
 */
export function parseContactFinderJson(text: string): ContactFinderResult {
  const body = extractJsonFence(text);
  if (!body) throw new ContactFinderParseError("La respuesta de Claude no trae el bloque JSON de contactos");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ContactFinderParseError("El bloque JSON de la respuesta de Claude no es válido");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new ContactFinderParseError("La respuesta de Claude no tiene el formato esperado");
  }
  const top = resultSchema.parse(json);
  const candidates: ContactCandidate[] = [];
  for (const raw of top.candidates) {
    if (!raw || typeof raw !== "object") continue;
    const c = candidateSchema.safeParse(raw);
    if (!c.success) continue;
    if (!c.data.name && !c.data.role && !c.data.organization && !c.data.handle) continue;
    candidates.push(c.data);
    if (candidates.length >= 8) break;
  }
  return { candidates, summary: top.summary, caveats: top.caveats };
}

/** Minimal structural view of a Messages API content block (SDK-free). */
export type ContentBlockLike = { type: string; text?: string; content?: unknown };

/**
 * Parse Claude's response content: the json fence of the LAST text block; if
 * that block has none (web-search citations can split the answer into several
 * text blocks), the concatenation of every text block.
 */
export function parseContactFinderContent(content: ContentBlockLike[]): ContactFinderResult {
  const texts = content.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text as string);
  if (!texts.length) throw new ContactFinderParseError("Claude no devolvió texto");
  const last = texts[texts.length - 1];
  if (/```/.test(last)) {
    try {
      return parseContactFinderJson(last);
    } catch (err) {
      if (texts.length === 1) throw err;
    }
  }
  return parseContactFinderJson(texts.join(""));
}

/** URLs of every web_search_result in the response (deduped, in order). */
export function collectSearchSources(content: ContentBlockLike[]): { url: string; title: string | null }[] {
  const seen = new Set<string>();
  const out: { url: string; title: string | null }[] = [];
  for (const block of content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue; // error results are objects
    for (const r of block.content as { type?: string; url?: unknown; title?: unknown }[]) {
      if (r?.type !== "web_search_result" || typeof r.url !== "string" || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ url: r.url, title: typeof r.title === "string" ? r.title : null });
    }
  }
  return out;
}

// ─── Formatter ───────────────────────────────────────────

/**
 * The Spanish `contactNotes` text: internal contacts (verbatim), numbered
 * possible contacts, summary, caveats and the "verify" reminder.
 */
export function formatContactNotes(
  internal: InternalContact[],
  result: ContactFinderResult,
  fallbackSources: { url: string; title: string | null }[] = []
): string {
  const out: string[] = [];

  if (internal.length) {
    out.push("Contactos internos:");
    for (const c of internal) {
      const head = [c.name, c.outlet].filter(Boolean).join(" — ");
      const rest = [c.beat, c.email, c.phone, c.city].filter(Boolean).join(" · ");
      out.push(`- ${head}${rest ? ` · ${rest}` : ""}`);
    }
    out.push("");
  }

  out.push("Posibles contactos:");
  if (!result.candidates.length) {
    out.push("No se encontró un contacto específico.");
  } else {
    result.candidates.forEach((c, i) => {
      const who = c.name ?? "Canal oficial";
      const what = [c.role, c.organization].filter(Boolean).join(", ");
      const parts = [
        `${i + 1}. ${who}${what ? ` — ${what}` : ""}`,
        `${CHANNEL_LABEL[c.channel]}: ${c.handle ?? "—"}`,
        `confianza ${c.confidence}`,
      ];
      out.push(parts.join(" · "));
      if (c.howToApproach) out.push(`   Cómo abordar: ${c.howToApproach}`);
      if (c.sourceUrl) out.push(`   Fuente: ${c.sourceUrl}`);
    });
  }

  if (!result.candidates.some((c) => c.sourceUrl) && fallbackSources.length) {
    out.push("", "Fuentes consultadas:");
    for (const s of fallbackSources.slice(0, 5)) out.push(`- ${s.url}`);
  }

  if (result.summary) out.push("", `Resumen: ${result.summary}`);
  if (result.caveats) out.push("", `Ojo: ${result.caveats}`);
  out.push("", "Verificar antes de contactar.");

  const text = out.join("\n").trim();
  return text.length > CONTACT_NOTES_MAX ? text.slice(0, CONTACT_NOTES_MAX - 1).trimEnd() + "…" : text;
}
