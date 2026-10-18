/**
 * "Type a brand, get a campaign" (EBM handoff, Oct 18 2026). One text box: the brand name plus anything the
 * team knows. The model proposes a slate using ONLY the roster in the database, with the hard rules below
 * (no invented names or numbers, no availability, no rates). Humans approve before anything reaches a brand.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { rosterForModel } from "@/lib/talents";

export const SuggestionSchema = z.object({
  brandRead: z.string(),
  marketAssumption: z.string(),
  shortlist: z.array(z.object({
    name: z.string(),
    reachSummary: z.string(),
    whyThisOne: z.string(),
    role: z.enum(["lead", "support", "reach"]),
    flag: z.string().nullable(),
  })),
  concept: z.string(),
  packagePerCreator: z.string(),
  openQuestions: z.array(z.string()),
  risks: z.array(z.string()),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You suggest influencer campaigns for EB Public Relations, a talent management
and PR agency representing Latin American and US-Hispanic creators.

You are given the agency's full roster as JSON and the name of a brand. Propose
a campaign using only creators from that roster.

HOW TO PICK
Weigh these, in order:
1. Market fit — does the creator's audience live where the brand sells? A
   Miami-based creator usually has a US-Hispanic audience; a Mexico City-based
   one usually has a Mexican audience. Country and location are in the data.
2. Category fit — verticals, and what the brand actually sells.
3. Proven fit — the pastBrands field. A creator a comparable brand has already
   paid for is the strongest signal in the dataset. Say so when it applies.
4. Reach — last, not first. A smaller creator in the right market beats a
   bigger one in the wrong one.

Pick between four and eight. Name a lead or two and say why they lead.

HARD RULES
- Use only creators present in the roster JSON. Never invent a name. Write each name exactly as it appears in the roster.
- Never invent or round a follower count. Use the numbers as given. Where
  followers are null, write "count not on file" — do not estimate, and do not
  drop the creator for it if they otherwise fit.
- Where a talent's notes flag that a number is unverified or that sources
  conflict, carry that flag into your output.
- Never say a creator is available or interested. Availability is always
  subject to confirming with the talent.
- Never state a rate. Pricing is set by Benjy and Esther, not by you.
- If the brand is unfamiliar, say what you are assuming about it rather than
  asserting facts you do not have.
- If the brief does not say which market, assume the brand's home market, state
  that you assumed it, and make it the first open question.
- Flag real tensions. If the best category fit is wrong for the brand's register
  — a loud, youth-skewing creator for a premium brand — say so plainly and let
  the humans decide. A suggestion nobody can trust is worth nothing.
- The tier field says the agency's relationship (RETAINER, OFF_RETAINER, ACCESS, UNSET); mention it in whyThisOne only when it matters.

VOICE
Direct and specific. No marketing language, no filler, no exclamation points.
Short sentences. Every claim about a creator traceable to their roster record.
Write in Spanish unless the brief is written in English.`;

export type SuggestResult = { ok: true; suggestion: Suggestion; model: string; usage: { input: number; cached: number; output: number } } | { ok: false; error: string };

export async function suggestCampaign(brand: string, brief?: string | null, filter?: { ids?: string[] }): Promise<SuggestResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "ANTHROPIC_API_KEY no está configurada." };
  const roster = await rosterForModel(filter);
  if (!roster.length) return { ok: false, error: "No hay talentos activos en la base." };
  const client = new Anthropic({ timeout: 300_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(SuggestionSchema) },
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        // The roster is the same on every request: cache it.
        { type: "text", text: `ROSTER (${roster.length} talents):\n${JSON.stringify(roster)}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: `Brand: ${brand.trim()}\n\nWhat we know:\n${brief?.trim() || "(nothing yet — just the name)"}` }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "El modelo declinó esta solicitud." };
    if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, error: "La respuesta llegó incompleta. Vuelve a intentar." };
    // Belt and braces: every shortlisted name must exist in the roster.
    const names = new Set(roster.map((r) => r.name.toLowerCase()));
    const bad = response.parsed_output.shortlist.filter((s) => !names.has(s.name.toLowerCase()));
    if (bad.length) return { ok: false, error: `La sugerencia nombró talentos que no están en la base (${bad.map((b) => b.name).join(", ")}). Vuelve a intentar.` };
    const u = response.usage;
    return { ok: true, suggestion: response.parsed_output, model: response.model, usage: { input: u.input_tokens, cached: u.cache_read_input_tokens ?? 0, output: u.output_tokens } };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "Límite de uso alcanzado, intenta en un minuto." };
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "La clave de Anthropic no es válida." };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `Error de la API (${err.status}): ${err.message}` };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
