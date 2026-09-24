// Contact finder ("Contacto / fuente") — server side: the internal Journalist
// matcher, the Claude + web search research run (findContacts), saving the
// result on a strategy item / suggestion, and the shared API helpers.
//
// INTERNAL ONLY: contactNotes live on StrategyItem / ClientSuggestion, which the
// client portal never reads. Never copy them into Deliverable.notes.

import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { MissingApiKeyError, anthropicConfigured, generationErrorResponse } from "@/lib/client-suggestions";
import {
  CONTACT_FINDER_MODEL,
  CONTACT_FINDER_SYSTEM_PROMPT,
  CONTACT_NOTES_MAX,
  CONTACT_WEB_SEARCH_MAX_USES,
  ContactFinderParseError,
  buildContactFinderUserPrompt,
  collectSearchSources,
  formatContactNotes,
  parseContactFinderContent,
  type ContactFinderResult,
  type FindContactsInput,
  type InternalContact,
} from "@/lib/contact-finder-format";

export * from "@/lib/contact-finder-format";
export { MissingApiKeyError, anthropicConfigured };
export { MISSING_KEY_MESSAGE } from "@/lib/client-suggestions-format";

// ─── Internal contacts (Journalist table) ────────────────

/** Lowercase, accent-free, single-spaced (mirrors the SQL `fold` below). */
function fold(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTerms(input: Pick<FindContactsInput, "targetTitle" | "targetName">): string[] {
  const terms = [input.targetName, input.targetTitle].map((t) => fold(t ?? "")).filter((t) => t.length >= 3);
  return Array.from(new Set(terms));
}

/** SQL: lower + accent-free (Spanish accents) + trimmed. */
const sqlFold = (col: Prisma.Sql) =>
  Prisma.sql`trim(translate(lower(${col}), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio'))`;
/** The outlet without a trailing "(Univision)"-style qualifier. */
const PAREN_RE = "\\s*\\([^)]*\\)";
const OUTLET = sqlFold(Prisma.sql`regexp_replace(coalesce(j."outlet", ''), ${PAREN_RE}, '', 'g')`);
const OUTLET_FULL = sqlFold(Prisma.sql`coalesce(j."outlet", '')`);
const NAME = sqlFold(Prisma.sql`j."name"`);

/**
 * Active journalists whose outlet or name matches the target, case- and
 * accent-insensitive, in both directions ("Despierta America" matches the
 * outlet "Despierta América (Univision)", and so does a title like "Entrevista
 * en Despierta América"). Outlet matches first, exact before partial. At most
 * `limit` (5).
 */
export async function findInternalContacts(
  input: Pick<FindContactsInput, "targetTitle" | "targetName">,
  limit = 5
): Promise<InternalContact[]> {
  const terms = searchTerms(input);
  if (!terms.length) return [];

  const outletMatch = (t: string) => Prisma.sql`(length(${OUTLET}) >= 3 AND (
      ${OUTLET_FULL} LIKE '%' || ${t} || '%' OR ${t} LIKE '%' || ${OUTLET} || '%'))`;
  const nameMatch = (t: string) => Prisma.sql`(length(${NAME}) >= 5 AND (
      ${NAME} LIKE '%' || ${t} || '%' OR ${t} LIKE '%' || ${NAME} || '%'))`;
  const conditions = terms.map((t) => Prisma.sql`(${outletMatch(t)} OR ${nameMatch(t)})`);
  const primary = terms[0];

  return db.$queryRaw<InternalContact[]>`
    SELECT j."id", j."name", j."outlet", j."beat", j."email", j."phone", j."city"
    FROM "journalists" j
    WHERE j."isActive" = true AND (${Prisma.join(conditions, " OR ")})
    ORDER BY
      CASE
        WHEN ${OUTLET_FULL} = ${primary} THEN 0
        WHEN ${OUTLET} = ${primary} THEN 1
        WHEN ${Prisma.join(terms.map(outletMatch), " OR ")} THEN 2
        ELSE 3
      END,
      j."name" ASC
    LIMIT ${limit}
  `;
}

// ─── Research run ────────────────────────────────────────

/** "martes 23 de septiembre de 2026" (Miami). */
function todayLabelEs(now: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "America/New_York",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

export class ContactFinderError extends Error {}

export type FindContactsRaw = ContactFinderResult & {
  internal: InternalContact[];
  sources: { url: string; title: string | null }[];
  model: string;
};

export type FindContactsOutput = { contactNotes: string; raw: FindContactsRaw };

/** Whole-run budget; the routes' maxDuration is 120 s. */
const RUN_BUDGET_MS = 110_000;
/** Resume at most twice when the server-side web search loop pauses. */
const MAX_CONTINUATIONS = 2;

/**
 * Internal Journalist matches + Claude (Opus 5, adaptive thinking, web search)
 * looking for real entry points to the target. Returns the formatted Spanish
 * `contactNotes` and the raw structured result.
 * Throws MissingApiKeyError, ContactFinderError, ContactFinderParseError or the
 * SDK's typed errors (Anthropic.APIError and subclasses).
 */
export async function findContacts(input: FindContactsInput, now: Date = new Date()): Promise<FindContactsOutput> {
  if (!anthropicConfigured()) throw new MissingApiKeyError();

  const internal = await findInternalContacts(input);

  // Reads ANTHROPIC_API_KEY. No SDK retries: a retry would not fit in the budget.
  const anthropic = new Anthropic({ timeout: RUN_BUDGET_MS, maxRetries: 0 });
  const started = Date.now();
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: CONTACT_WEB_SEARCH_MAX_USES },
  ];
  const userPrompt = buildContactFinderUserPrompt(input, internal, todayLabelEs(now));
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  let response: Anthropic.Message | null = null;
  const content: Anthropic.ContentBlock[] = [];
  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const remaining = RUN_BUDGET_MS - (Date.now() - started);
    if (remaining < 15_000) break;
    response = await anthropic.messages.create(
      {
        model: CONTACT_FINDER_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: CONTACT_FINDER_SYSTEM_PROMPT,
        tools,
        messages,
      },
      { timeout: remaining }
    );
    content.push(...response.content);
    if (response.stop_reason !== "pause_turn") break;
    // The server-side search loop paused: send the turn back so it resumes.
    messages.push({ role: "assistant", content: response.content });
  }
  if (!response) throw new ContactFinderError("Claude tardó demasiado en responder. Intenta de nuevo.");

  console.log(
    `[contact-finder] model=${response.model} stop=${response.stop_reason} ` +
      `input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens} ` +
      `web_searches=${response.usage.server_tool_use?.web_search_requests ?? 0} internal=${internal.length} ` +
      `ms=${Date.now() - started}`
  );

  if (response.stop_reason === "refusal") {
    throw new ContactFinderError("Claude no quiso investigar este contacto");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ContactFinderError("La respuesta de Claude quedó incompleta. Intenta de nuevo.");
  }
  if (response.stop_reason === "pause_turn") {
    throw new ContactFinderError("La búsqueda no terminó a tiempo. Intenta de nuevo.");
  }

  // Parse only the final turn's text (earlier paused turns are research notes).
  const result = parseContactFinderContent(response.content);
  const sources = collectSearchSources(content);
  const contactNotes = formatContactNotes(internal, result, sources);

  return {
    contactNotes,
    raw: { ...result, internal, sources, model: response.model || CONTACT_FINDER_MODEL },
  };
}

/** Spanish message + HTTP status for an error thrown by findContacts. */
export function contactErrorResponse(err: unknown): { status: number; error: string } {
  if (err instanceof ContactFinderError || err instanceof ContactFinderParseError) {
    return { status: 502, error: err.message };
  }
  const mapped = generationErrorResponse(err);
  if (mapped.status === 500) return { status: 500, error: "No se pudo buscar el contacto" };
  return mapped;
}

// ─── Saving ──────────────────────────────────────────────

export const contactSelect = {
  contactNotes: true,
  contactSource: true,
  contactUpdatedAt: true,
} as const;

export type ContactState = {
  contactNotes: string | null;
  contactSource: string | null;
  contactUpdatedAt: Date | null;
};

const AI_MARKER = "— Búsqueda IA —";

/**
 * Notes to store after an AI search. Whatever the team wrote is kept on top
 * (a search never erases it); a previous AI section is replaced.
 */
export function mergeAiNotes(current: Pick<ContactState, "contactNotes" | "contactSource">, aiNotes: string): string {
  const notes = (current.contactNotes ?? "").trim();
  const at = notes.indexOf(AI_MARKER);
  const team = at !== -1 ? notes.slice(0, at).trim() : current.contactSource === "TEAM" ? notes : "";
  const merged = team ? `${team}\n\n${AI_MARKER}\n${aiNotes}` : aiNotes;
  return merged.length > CONTACT_NOTES_MAX ? merged.slice(0, CONTACT_NOTES_MAX - 1).trimEnd() + "…" : merged;
}

// ─── API helpers ─────────────────────────────────────────

/** PATCH body of the manual save: an empty note clears the contact. */
export const contactPatchSchema = z.object({
  contactNotes: z
    .string({ invalid_type_error: "El contacto debe ser texto", required_error: "Falta el contacto" })
    .max(CONTACT_NOTES_MAX, `Máximo ${CONTACT_NOTES_MAX} caracteres`)
    .nullable()
    .transform((v) => (v ?? "").trim()),
});

/** Prisma data for a manual save (contactSource "TEAM") or a clear. */
export function manualContactData(notes: string) {
  return notes
    ? { contactNotes: notes, contactSource: "TEAM", contactUpdatedAt: new Date() }
    : { contactNotes: null, contactSource: null, contactUpdatedAt: null };
}

export async function readJsonBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const text = await req.text();
    return { ok: true, body: text.trim() ? JSON.parse(text) : {} };
  } catch {
    return { ok: false };
  }
}

export function contactJsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

type Authorized =
  | { user: SessionUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

/** 401 when signed out, 403 for every role that is not admin/strategist. */
export async function authorizeContacts(): Promise<Authorized> {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 }) };
  }
  if (!canManageClients(user)) {
    return { error: NextResponse.json({ error: "No tienes permiso para ver ni editar contactos" }, { status: 403 }) };
  }
  return { user };
}
