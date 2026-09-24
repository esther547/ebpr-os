// Client suggestions ("Sugerencias") — pure pieces shared by the server, the
// browser and the unit test: categories and labels, the system prompt, the
// JSON schema Claude must answer with, and the parser/validator of that answer.
// No Prisma / SDK / React imports here.

import { z } from "zod";

// ─── Model ───────────────────────────────────────────────

export const SUGGESTIONS_MODEL = "claude-opus-5";

export const MISSING_KEY_MESSAGE = "Falta configurar ANTHROPIC_API_KEY en Vercel";

// ─── Categories / effort / status ────────────────────────

export const SUGGESTION_CATEGORIES = [
  "MEDIA_TARGET",
  "INFLUENCER",
  "EVENT",
  "BRAND_OPPORTUNITY",
  "SOCIAL_MEDIA",
  "PRESS_RELEASE",
  "OTHER",
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_CATEGORY_LABEL: Record<SuggestionCategory, string> = {
  MEDIA_TARGET: "Medios",
  INFLUENCER: "Creadores",
  EVENT: "Evento",
  BRAND_OPPORTUNITY: "Marca",
  SOCIAL_MEDIA: "Redes sociales",
  PRESS_RELEASE: "Comunicado",
  OTHER: "Otro",
};

/** Suggestion category -> the goal (Deliverable) type it becomes. */
export const CATEGORY_TO_DELIVERABLE_TYPE = {
  MEDIA_TARGET: "PRESS_PLACEMENT",
  INFLUENCER: "INFLUENCER_COLLAB",
  EVENT: "EVENT_APPEARANCE",
  BRAND_OPPORTUNITY: "BRAND_OPPORTUNITY",
  SOCIAL_MEDIA: "SOCIAL_MEDIA",
  PRESS_RELEASE: "PRESS_RELEASE",
  OTHER: "OTHER",
} as const satisfies Record<SuggestionCategory, string>;

export function categoryLabel(category: string): string {
  return SUGGESTION_CATEGORY_LABEL[category as SuggestionCategory] ?? "Otro";
}

export function deliverableTypeFor(category: string) {
  return CATEGORY_TO_DELIVERABLE_TYPE[category as SuggestionCategory] ?? "OTHER";
}

export const SUGGESTION_EFFORTS = ["bajo", "medio", "alto"] as const;
export type SuggestionEffort = (typeof SUGGESTION_EFFORTS)[number];

export const SUGGESTION_STATUSES = ["NEW", "IN_PROGRESS", "DONE", "DISMISSED"] as const;
export type SuggestionStatusValue = (typeof SUGGESTION_STATUSES)[number];

export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatusValue, string> = {
  NEW: "Nuevas",
  IN_PROGRESS: "En curso",
  DONE: "Logradas",
  DISMISSED: "Descartadas",
};

// ─── Prompt ──────────────────────────────────────────────

export const SUGGESTIONS_SYSTEM_PROMPT = `Eres una estratega senior de relaciones públicas para el mercado latino en EB Public Relations, una agencia de PR en Miami que representa a artistas, talentos, creadores y marcas latinas en Estados Unidos y Latinoamérica.

Vas a recibir el perfil completo de UN cliente de la agencia: su estrategia, los targets que el equipo ya identificó (medios, creadores, marcas, eventos), el wish list que el propio cliente pidió, las metas que ya se lograron y las que están en gestión, su agenda, sus fechas de viaje o no disponibilidad, los eventos de la industria que vienen y las prioridades del equipo para esta semana.

Tu tarea: proponer entre 6 y 8 movimientos de PR concretos y accionables para ESTE cliente, que un estratega del equipo pueda ejecutar en las próximas 4 a 8 semanas. Piensa como su publicista: ¿qué harías tú ahora mismo para que este cliente gane visibilidad y cierre metas?

Criterios:
- Cada sugerencia debe apoyarse en algo real del perfil: un target de su estrategia, un pedido del wish list, un evento de la industria que se acerca, un viaje (buscar oportunidades en esa ciudad) o un hueco evidente (por ejemplo, una categoría de metas que no se ha trabajado).
- Nombra medios, programas, podcasts, creadores, marcas y eventos específicos cuando el contexto los tenga. Si propones un nombre que no está en el contexto, que sea claramente coherente con su industria y su mercado, y dilo en la justificación. No inventes contactos, fechas ni acuerdos existentes.
- No repitas lo que ya se logró recientemente, lo que ya está en gestión, lo que ya está en las prioridades de esta semana ni sugerencias anteriores, salvo que propongas un siguiente paso distinto y lo expliques.
- Respeta la disponibilidad: nada en fechas en que el cliente no está disponible. Si viaja, aprovecha la ciudad de destino.
- Si el cliente debe metas o va atrasado en el ciclo, incluye movimientos que se puedan cerrar rápido.
- Mezcla categorías (no más de 3 de la misma) y combina victorias rápidas con al menos una jugada de mayor impacto.
- Ten en cuenta los tiempos reales del PR: los medios y eventos necesitan pitch con semanas de anticipación.

Formato de cada sugerencia:
- title: la acción en una sola línea, en español, empezando con un verbo en infinitivo (por ejemplo "Pitchear a Despierta América una entrevista sobre su nuevo sencillo"). Máximo unos 120 caracteres.
- rationale: 2 o 3 oraciones: por qué encaja con este cliente, qué dato del perfil lo respalda y cuál es el primer paso concreto.
- category: MEDIA_TARGET (prensa, TV, radio, podcasts), INFLUENCER (creadores y colaboraciones), EVENT (eventos, alfombras rojas, apariciones), BRAND_OPPORTUNITY (marcas y alianzas), SOCIAL_MEDIA (contenido o dinámicas en redes), PRESS_RELEASE (comunicado o anuncio) u OTHER.
- effort: "bajo", "medio" o "alto", según el trabajo del equipo para lograrlo.
- timing: cuándo moverlo, con fechas reales del contexto cuando existan (por ejemplo "antes del 20 de octubre (Latin Billboard)" o "esta semana").

Escribe en español neutro, directo y profesional, sin preámbulos.`;

/** The user turn: today's date plus the client profile built by buildClientContext. */
export function buildSuggestionsUserPrompt(context: string, todayLabel: string): string {
  return `Hoy es ${todayLabel} (hora de Miami).

<perfil_cliente>
${context.trim()}
</perfil_cliente>

Propón entre 6 y 8 movimientos de PR para este cliente siguiendo los criterios.`;
}

// ─── Output schema (structured outputs) ──────────────────

export const SUGGESTIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          category: { type: "string", enum: [...SUGGESTION_CATEGORIES] },
          effort: { type: "string", enum: [...SUGGESTION_EFFORTS] },
          timing: { type: "string" },
        },
        required: ["title", "rationale", "category", "effort", "timing"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

const clip = (max: number) => (v: string) => (v.length > max ? v.slice(0, max - 1).trimEnd() + "…" : v);

const suggestionSchema = z.object({
  title: z.string().trim().min(1).transform(clip(300)),
  rationale: z.string().trim().min(1).transform(clip(2000)),
  category: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .transform((v): SuggestionCategory =>
      (SUGGESTION_CATEGORIES as readonly string[]).includes(v) ? (v as SuggestionCategory) : "OTHER"
    ),
  effort: z
    .string()
    .nullish()
    .transform((v): SuggestionEffort | null => {
      const e = (v ?? "").trim().toLowerCase();
      return (SUGGESTION_EFFORTS as readonly string[]).includes(e) ? (e as SuggestionEffort) : null;
    }),
  timing: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() ? clip(200)(v.trim()) : null)),
});

const responseSchema = z.object({
  suggestions: z.array(suggestionSchema).min(1),
});

export type ParsedSuggestion = z.infer<typeof suggestionSchema>;

export class SuggestionsParseError extends Error {}

/**
 * Validate Claude's JSON answer (the text of the response's text block).
 * Returns at most 10 suggestions; throws SuggestionsParseError when the text
 * is not JSON or does not match the schema.
 */
export function parseSuggestionsResponse(text: string): ParsedSuggestion[] {
  let json: unknown;
  try {
    json = JSON.parse(text.trim());
  } catch {
    throw new SuggestionsParseError("La respuesta de Claude no es JSON válido");
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new SuggestionsParseError(
      "La respuesta de Claude no tiene el formato esperado: " +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
  }
  return parsed.data.suggestions.slice(0, 10);
}
