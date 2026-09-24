// Client suggestions ("Sugerencias") — server side: the client profile sent to
// Claude (buildClientContext), the generation run (generateSuggestions) and the
// shared API helpers (access check, Spanish errors).
//
// Every date decision uses Miami calendar days (see miami-time.ts).

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { currentCycle } from "@/lib/cycles";
import { upcomingEvents } from "@/lib/industry-events";
import { currentAndUpcoming, describeWindow } from "@/lib/client-availability";
import { resolveWeekKey, weekOfInstant } from "@/lib/priorities";
import { addDaysKey, dayKeyInTz, tzMidnight } from "@/components/runners/miami-time";
import { approxDateLabel, MONTHS_ES } from "@/components/events/helpers";
import {
  MISSING_KEY_MESSAGE,
  SUGGESTIONS_JSON_SCHEMA,
  SUGGESTIONS_MODEL,
  SUGGESTIONS_SYSTEM_PROMPT,
  SuggestionsParseError,
  buildSuggestionsUserPrompt,
  parseSuggestionsResponse,
} from "@/lib/client-suggestions-format";

export * from "@/lib/client-suggestions-format";

// ─── Formatting helpers ──────────────────────────────────

/** ~6k tokens of Spanish text. */
const MAX_CONTEXT_CHARS = 24_000;

function one(value: string | null | undefined, max = 240): string {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v.length > max ? v.slice(0, max - 1).trimEnd() + "…" : v;
}

/** "23 sep 2026" for a "yyyy-MM-dd" key. */
function dayLabel(key: string): string {
  return `${Number(key.slice(8, 10))} ${MONTHS_ES[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${key.slice(0, 4)}`;
}

/** Stored date-only values (12:00 UTC) keep their UTC day; instants use the Miami day. */
function dateLabel(d: Date | null | undefined, dateOnly = false): string {
  if (!d) return "";
  return dayLabel(dateOnly ? d.toISOString().slice(0, 10) : dayKeyInTz(d));
}

function jsonStrings(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

const STRATEGY_STATUS_ES: Record<string, string> = {
  IDEA: "idea",
  APPROVED: "aprobado",
  IN_PROGRESS: "en gestión",
  COMPLETED: "logrado",
  REJECTED: "descartado",
  ON_HOLD: "en pausa",
};

const DELIVERABLE_TYPE_ES: Record<string, string> = {
  PRESS_PLACEMENT: "prensa",
  INTERVIEW: "entrevista",
  INFLUENCER_COLLAB: "colaboración con creador",
  EVENT_APPEARANCE: "evento",
  BRAND_OPPORTUNITY: "marca",
  INTRODUCTION: "introducción",
  SOCIAL_MEDIA: "redes sociales",
  PRESS_RELEASE: "comunicado",
  OTHER: "otro",
};

const DELIVERABLE_STATUS_ES: Record<string, string> = {
  IDEA: "idea",
  OUTREACH: "en outreach",
  CONFIRMED: "confirmada",
  IN_PROGRESS: "en ejecución",
  COMPLETED: "lograda",
  CANCELLED: "cancelada",
};

const CLIENT_STATUS_ES: Record<string, string> = {
  PROSPECT: "prospecto",
  ACTIVE: "activo",
  PAUSED: "en pausa",
  CHURNED: "terminado",
};

const EVENT_CATEGORY_ES: Record<string, string> = {
  AWARDS: "premios",
  FASHION: "moda",
  FILM: "cine",
  GALA: "gala",
  SPORTS: "deportes",
  MEDIA: "medios",
  OTHER: "otro",
};

// ─── Context builder ─────────────────────────────────────

export class ClientNotFoundError extends Error {}

/**
 * The client's profile as a compact Spanish text block (≤ ~6k tokens):
 * client data and cycle progress, strategy document, strategy targets by
 * category, the client's wish list, recent closed goals and open goals, the
 * agenda for the next 60 days, availability/travel for the next 120 days,
 * industry events in the next 120 days, this week's priorities and previous
 * suggestions (so Claude does not repeat them).
 */
export async function buildClientContext(clientId: string, now: Date = new Date()): Promise<string> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      industry: true,
      description: true,
      website: true,
      status: true,
      monthlyTarget: true,
      cycleDay: true,
      goalsOwed: true,
      focusNote: true,
    },
  });
  if (!client) throw new ClientNotFoundError("Cliente no encontrado");

  const todayKey = dayKeyInTz(now);
  const cycle = currentCycle(client.cycleDay, now);
  const agendaEnd = tzMidnight(addDaysKey(todayKey, 61));
  const weekOf = weekOfInstant(resolveWeekKey(todayKey));

  const [doc, strategyItems, cycleGoals, closedGoals, openGoals, agenda, windows, events, priorities, previous] =
    await Promise.all([
      db.strategyDocument.findUnique({
        where: { clientId },
        select: {
          objective: true,
          purpose: true,
          strategicPath: true,
          messagingFramework: true,
          keyMessages: true,
          clientPersona: true,
          targetAudience: true,
          executionNotes: true,
          location: true,
        },
      }),
      db.strategyItem.findMany({
        where: { clientId },
        select: {
          title: true,
          description: true,
          category: true,
          status: true,
          notes: true,
          targetName: true,
          brandCategory: true,
          eventLocation: true,
          scheduledDate: true,
          targetDate: true,
          isBigWin: true,
          source: true,
          requestedAt: true,
          createdAt: true,
        },
        orderBy: [{ isBigWin: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
      }),
      db.deliverable.findMany({
        where: { clientId, month: cycle.month, year: cycle.year },
        select: { status: true },
      }),
      db.deliverable.findMany({
        where: {
          clientId,
          OR: [{ closedAt: { not: null } }, { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } }],
          NOT: { status: "CANCELLED" },
        },
        select: { title: true, type: true, status: true, closedAt: true, completedAt: true, dueDate: true, updatedAt: true },
        orderBy: [{ closedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
        take: 15,
      }),
      db.deliverable.findMany({
        where: { clientId, status: { in: ["IDEA", "OUTREACH"] }, closedAt: null },
        select: { title: true, type: true, status: true, dueDate: true, notes: true },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 20,
      }),
      db.runnerAssignment.findMany({
        where: {
          clientId,
          status: { not: "CANCELLED" },
          eventDate: { gte: tzMidnight(todayKey), lt: agendaEnd },
        },
        select: { eventDate: true, eventName: true, itemType: true, venueName: true, location: true },
        orderBy: { eventDate: "asc" },
        take: 25,
      }),
      currentAndUpcoming(clientId, now),
      upcomingEvents(120, now),
      db.weeklyPriority.findMany({
        where: { weekOf, clientId },
        select: { title: true, notes: true, isDone: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      db.clientSuggestion.findMany({
        where: { clientId },
        select: { title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  const lines: string[] = [];
  const section = (title: string) => lines.push("", `## ${title}`);

  // Client
  lines.push(`# Cliente: ${client.name}`);
  if (client.industry) lines.push(`Industria: ${one(client.industry)}`);
  lines.push(`Estado: ${CLIENT_STATUS_ES[client.status] ?? client.status}`);
  if (client.description) lines.push(`Descripción: ${one(client.description, 600)}`);
  if (client.website) lines.push(`Web: ${one(client.website)}`);
  const completed = cycleGoals.filter((d) => d.status === "COMPLETED").length;
  const secured = cycleGoals.filter((d) => ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(d.status)).length;
  const lastDayKey = addDaysKey(cycle.endKey, -1);
  const cycleName =
    `${MONTHS_ES[cycle.month - 1]} ${cycle.year}` +
    (client.cycleDay && client.cycleDay !== 1 ? `, del ${dayLabel(cycle.startKey)} al ${dayLabel(lastDayKey)}` : "");
  if (client.monthlyTarget > 0) {
    lines.push(
      `Meta mensual: ${client.monthlyTarget} metas. Ciclo actual (${cycleName}): ${completed}/${client.monthlyTarget} logradas, ${secured} aseguradas en total.`
    );
  } else {
    lines.push("Mes de preparación: todavía sin meta mensual.");
  }
  if (client.goalsOwed > 0) lines.push(`Metas atrasadas que se le deben: ${client.goalsOwed}`);
  if (client.focusNote) lines.push(`Foco indicado por el equipo: ${one(client.focusNote, 400)}`);

  // Strategy document
  if (doc) {
    section("Estrategia");
    if (doc.objective) lines.push(`Objetivo: ${one(doc.objective, 600)}`);
    if (doc.purpose) lines.push(`Propósito: ${one(doc.purpose, 400)}`);
    if (doc.strategicPath) lines.push(`Camino estratégico / posicionamiento: ${one(doc.strategicPath, 600)}`);
    if (doc.messagingFramework) lines.push(`Marco de mensajes: ${one(doc.messagingFramework, 400)}`);
    const keyMessages = jsonStrings(doc.keyMessages).slice(0, 8);
    if (keyMessages.length) lines.push(`Mensajes clave: ${keyMessages.map((m) => one(m, 160)).join(" | ")}`);
    if (doc.clientPersona) lines.push(`Perfil del cliente: ${one(doc.clientPersona, 500)}`);
    if (doc.targetAudience) lines.push(`Audiencia objetivo: ${one(doc.targetAudience, 400)}`);
    if (doc.executionNotes) lines.push(`Foco de ejecución ahora: ${one(doc.executionNotes, 600)}`);
    if (doc.location) lines.push(`Base / mercado: ${one(doc.location)}`);
  }

  // Strategy targets by category (team items; the client's wish list goes below)
  const teamItems = strategyItems.filter((i) => i.source !== "CLIENT" && i.status !== "REJECTED");
  const itemLine = (i: (typeof strategyItems)[number]) => {
    const name = i.targetName && !i.title.includes(i.targetName) ? `${i.title} (${i.targetName})` : i.title;
    const extra = [
      STRATEGY_STATUS_ES[i.status] ?? i.status,
      i.isBigWin ? "gran victoria" : "",
      i.brandCategory ?? "",
      i.eventLocation ?? "",
      i.scheduledDate ? dateLabel(i.scheduledDate) : i.targetDate ? `para ${dateLabel(i.targetDate)}` : "",
      one(i.notes ?? i.description, 140),
    ].filter(Boolean);
    return `- ${one(name, 160)}${extra.length ? ` — ${extra.join("; ")}` : ""}`;
  };
  const groups: [string, string][] = [
    ["MEDIA_TARGET", "Medios objetivo"],
    ["INFLUENCER", "Creadores objetivo"],
    ["BRAND_OPPORTUNITY", "Marcas objetivo"],
    ["EVENT", "Eventos objetivo"],
    ["POSITIONING", "Ángulos de posicionamiento"],
  ];
  for (const [cat, title] of groups) {
    const items = teamItems.filter((i) => i.category === cat);
    if (!items.length) continue;
    section(`${title} (${items.length} en la estrategia${items.length > 15 ? ", se muestran 15" : ""})`);
    items.slice(0, 15).forEach((i) => lines.push(itemLine(i)));
  }

  // Wish list
  const wish = strategyItems
    .filter((i) => i.source === "CLIENT")
    .sort((a, b) => (b.requestedAt ?? b.createdAt).getTime() - (a.requestedAt ?? a.createdAt).getTime())
    .slice(0, 15);
  if (wish.length) {
    section("Wish list del cliente (lo que el cliente pidió)");
    wish.forEach((i) =>
      lines.push(
        `- ${one(i.title, 160)} — ${[
          STRATEGY_STATUS_ES[i.status] ?? i.status,
          `pedido el ${dateLabel(i.requestedAt ?? i.createdAt, !!i.requestedAt)}`,
          one(i.notes, 240),
        ]
          .filter(Boolean)
          .join("; ")}`
      )
    );
  }

  // Goals
  section("Metas logradas o aseguradas recientemente (no repetir)");
  if (closedGoals.length) {
    closedGoals.forEach((d) => {
      const when = d.closedAt ?? d.completedAt ?? d.dueDate ?? d.updatedAt;
      lines.push(
        `- ${one(d.title, 160)} — ${DELIVERABLE_TYPE_ES[d.type] ?? d.type}; ${DELIVERABLE_STATUS_ES[d.status] ?? d.status}; ${dateLabel(when)}`
      );
    });
  } else {
    lines.push("- Ninguna registrada todavía.");
  }
  if (openGoals.length) {
    section("Metas en gestión ahora (ya se están trabajando)");
    openGoals.forEach((d) =>
      lines.push(
        `- ${one(d.title, 160)} — ${DELIVERABLE_TYPE_ES[d.type] ?? d.type}; ${DELIVERABLE_STATUS_ES[d.status] ?? d.status}${
          d.dueDate ? `; para ${dateLabel(d.dueDate)}` : ""
        }`
      )
    );
  }

  // Agenda
  if (agenda.length) {
    section("Agenda próxima (60 días)");
    agenda.forEach((a) =>
      lines.push(
        `- ${dateLabel(a.eventDate)}: ${one(a.eventName, 160)}${[a.itemType, a.venueName, a.location]
          .filter(Boolean)
          .map((v) => `; ${one(v, 80)}`)
          .join("")}`
      )
    );
  }

  // Availability / travel (next 120 days)
  const horizonKey = addDaysKey(todayKey, 120);
  const soon = windows.filter((w) => w.startKey <= horizonKey);
  if (soon.length) {
    section("Disponibilidad y viajes (120 días)");
    soon.forEach((w) =>
      lines.push(`- ${w.kind === "OFF" ? "NO DISPONIBLE" : "VIAJE"}: ${describeWindow(w)}`)
    );
  }

  // Industry events (next 120 days)
  if (events.length) {
    section("Eventos de la industria que vienen (120 días)");
    events.slice(0, 40).forEach((e) =>
      lines.push(
        `- ${e.name} — ${approxDateLabel(e.occursKey, e.day != null)} ${e.occursKey.slice(0, 4)}${
          e.city ? `; ${e.city}` : ""
        }; ${EVENT_CATEGORY_ES[e.category] ?? e.category}${e.notes ? `; ${one(e.notes, 120)}` : ""}`
      )
    );
  }

  // This week's priorities
  if (priorities.length) {
    section("Prioridades del equipo para este cliente esta semana");
    priorities.forEach((p) =>
      lines.push(`- ${p.isDone ? "[hecha] " : ""}${one(p.title, 160)}${p.notes ? ` — ${one(p.notes, 140)}` : ""}`)
    );
  }

  // Previous suggestions
  if (previous.length) {
    section("Sugerencias anteriores (no repetir)");
    const status: Record<string, string> = { NEW: "nueva", IN_PROGRESS: "en curso", DONE: "lograda", DISMISSED: "descartada" };
    previous.forEach((s) => lines.push(`- ${one(s.title, 160)} (${status[s.status] ?? s.status})`));
  }

  let text = lines.join("\n").trim();
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS) + "\n…(recortado)";
  return text;
}

// ─── Generation ──────────────────────────────────────────

export class MissingApiKeyError extends Error {
  constructor() {
    super(MISSING_KEY_MESSAGE);
  }
}

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

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

export type GenerateResult = {
  batchId: string;
  count: number;
  replaced: number;
  model: string;
};

/**
 * Ask Claude for 6–8 PR moves for the client and save them as a new batch.
 * With `replace`, NEW suggestions from earlier batches become DISMISSED (only
 * after the new batch was generated successfully).
 * Throws MissingApiKeyError, ClientNotFoundError, SuggestionsParseError or the
 * SDK's typed errors (Anthropic.APIError and subclasses).
 */
export async function generateSuggestions(
  clientId: string,
  userId: string,
  opts: { replace?: boolean; now?: Date } = {}
): Promise<GenerateResult> {
  if (!anthropicConfigured()) throw new MissingApiKeyError();
  const now = opts.now ?? new Date();

  const context = await buildClientContext(clientId, now);

  // Reads ANTHROPIC_API_KEY. Allow the long non-streaming call (the route's
  // maxDuration is 300 s) and one retry for transient 429/5xx.
  const anthropic = new Anthropic({ timeout: 240_000, maxRetries: 1 });
  const started = Date.now();
  const response = await anthropic.messages.create({
    model: SUGGESTIONS_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SUGGESTIONS_JSON_SCHEMA as unknown as Record<string, unknown> },
    },
    system: SUGGESTIONS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildSuggestionsUserPrompt(context, todayLabelEs(now)) }],
  });

  console.log(
    `[suggestions] client=${clientId} model=${response.model} stop=${response.stop_reason} ` +
      `input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens} ` +
      `context_chars=${context.length} ms=${Date.now() - started}`
  );

  if (response.stop_reason === "refusal") {
    throw new SuggestionsParseError("Claude no quiso generar sugerencias para este perfil");
  }
  if (response.stop_reason === "max_tokens") {
    throw new SuggestionsParseError("La respuesta de Claude quedó incompleta");
  }
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new SuggestionsParseError("Claude no devolvió texto");
  const suggestions = parseSuggestionsResponse(textBlock.text);

  const batchId = randomUUID();
  const replaced = await db.$transaction(async (tx) => {
    // Runs before the new batch exists, so only earlier NEW suggestions are dismissed.
    const dismissed = opts.replace
      ? (await tx.clientSuggestion.updateMany({ where: { clientId, status: "NEW" }, data: { status: "DISMISSED" } })).count
      : 0;
    await tx.clientSuggestion.createMany({
      data: suggestions.map((s) => ({
        clientId,
        title: s.title,
        rationale: s.rationale,
        category: s.category,
        effort: s.effort,
        timing: s.timing,
        batchId,
        model: response.model || SUGGESTIONS_MODEL,
        createdById: userId,
      })),
    });
    return dismissed;
  });

  return { batchId, count: suggestions.length, replaced, model: response.model || SUGGESTIONS_MODEL };
}

/** Spanish message + HTTP status for an error thrown by generateSuggestions. */
export function generationErrorResponse(err: unknown): { status: number; error: string } {
  if (err instanceof MissingApiKeyError) return { status: 503, error: MISSING_KEY_MESSAGE };
  if (err instanceof ClientNotFoundError) return { status: 404, error: "Cliente no encontrado" };
  if (err instanceof SuggestionsParseError) return { status: 502, error: err.message };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { status: 503, error: "La llave ANTHROPIC_API_KEY configurada en Vercel no es válida o no tiene permiso" };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, error: "Claude está recibiendo demasiadas solicitudes. Intenta de nuevo en un minuto." };
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, error: "Claude tardó demasiado en responder. Intenta de nuevo." };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 502, error: "No se pudo conectar con Claude. Intenta de nuevo." };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { status: 502, error: `Claude rechazó la solicitud: ${err.message}` };
  }
  if (err instanceof Anthropic.APIError) {
    return {
      status: 502,
      error:
        err.status === 529 || (err.status ?? 0) >= 500
          ? "Claude está saturado en este momento. Intenta de nuevo en unos minutos."
          : `Error de Claude (${err.status ?? "sin estado"}). Intenta de nuevo.`,
    };
  }
  return { status: 500, error: "No se pudieron generar las sugerencias" };
}

// ─── API helpers ─────────────────────────────────────────

type Authorized =
  | { user: SessionUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

/** 401 when signed out, 403 for every role that is not admin/strategist. */
export async function authorizeSuggestions(): Promise<Authorized> {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 }) };
  }
  if (!canManageClients(user)) {
    return { error: NextResponse.json({ error: "No tienes permiso para usar las sugerencias de clientes" }, { status: 403 }) };
  }
  return { user };
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const text = await req.text();
    return { ok: true, body: text.trim() ? JSON.parse(text) : {} };
  } catch {
    return { ok: false };
  }
}

export const suggestionSelect = {
  id: true,
  clientId: true,
  title: true,
  rationale: true,
  category: true,
  effort: true,
  timing: true,
  status: true,
  batchId: true,
  model: true,
  deliverableId: true,
  priorityId: true,
  contactNotes: true,
  contactSource: true,
  contactUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ClientSuggestionSelect;

export type SuggestionRow = Prisma.ClientSuggestionGetPayload<{ select: typeof suggestionSelect }>;

/** Suggestions of a client grouped by status, newest first. */
export async function listSuggestions(clientId: string) {
  const rows = await db.clientSuggestion.findMany({
    where: { clientId },
    select: suggestionSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  const grouped = { NEW: [] as SuggestionRow[], IN_PROGRESS: [] as SuggestionRow[], DONE: [] as SuggestionRow[], DISMISSED: [] as SuggestionRow[] };
  for (const r of rows) grouped[r.status].push(r);
  return grouped;
}
