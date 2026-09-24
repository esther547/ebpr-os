import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MISSING_KEY_MESSAGE,
  anthropicConfigured,
  authorizeSuggestions,
  generateSuggestions,
  generationErrorResponse,
  jsonError,
  readJson,
} from "@/lib/client-suggestions";

export const dynamic = "force-dynamic";
// Claude usually answers in 20–60 s; leave room for slow runs.
export const maxDuration = 300;

const bodySchema = z.object({
  replace: z.boolean({ invalid_type_error: "replace debe ser true o false" }).optional().default(false),
});

/**
 * POST /api/clients/:clientId/suggestions/generate { replace?: boolean }
 * Asks Claude for 6–8 PR moves for the client and saves them as a new batch.
 * replace=true dismisses the NEW suggestions of earlier batches.
 */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const auth = await authorizeSuggestions();
  if (auth.error) return auth.error;

  const read = await readJson(req);
  if (!read.ok) return jsonError("El cuerpo de la petición no es JSON válido");
  const parsed = bodySchema.safeParse(read.body);
  if (!parsed.success) return jsonError(parsed.error.issues.map((i) => i.message).join("; "));

  if (!anthropicConfigured()) return jsonError(MISSING_KEY_MESSAGE, 503);

  try {
    const result = await generateSuggestions(params.clientId, auth.user.id, { replace: parsed.data.replace });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    const { status, error } = generationErrorResponse(err);
    if (status >= 500) console.error("POST /suggestions/generate failed:", err);
    return jsonError(error, status);
  }
}
