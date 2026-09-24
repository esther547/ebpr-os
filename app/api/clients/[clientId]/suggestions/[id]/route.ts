import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  SUGGESTION_STATUSES,
  authorizeSuggestions,
  jsonError,
  readJson,
  suggestionSelect,
} from "@/lib/client-suggestions";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    status: z.enum(SUGGESTION_STATUSES, { errorMap: () => ({ message: "Estado no válido" }) }).optional(),
    title: z.string().trim().min(1, "El título es obligatorio").max(300, "Máximo 300 caracteres").optional(),
    rationale: z.string().trim().min(1, "La justificación es obligatoria").max(2000, "Máximo 2000 caracteres").optional(),
  })
  .refine((v) => v.status !== undefined || v.title !== undefined || v.rationale !== undefined, {
    message: "No hay cambios que guardar",
  });

/** PATCH /api/clients/:clientId/suggestions/:id { status?, title?, rationale? } */
export async function PATCH(req: Request, { params }: { params: { clientId: string; id: string } }) {
  const auth = await authorizeSuggestions();
  if (auth.error) return auth.error;

  const read = await readJson(req);
  if (!read.ok) return jsonError("El cuerpo de la petición no es JSON válido");
  const parsed = patchSchema.safeParse(read.body);
  if (!parsed.success) return jsonError(parsed.error.issues.map((i) => i.message).join("; "));

  const existing = await db.clientSuggestion.findFirst({
    where: { id: params.id, clientId: params.clientId },
    select: { id: true },
  });
  if (!existing) return jsonError("Sugerencia no encontrada", 404);

  const data = await db.clientSuggestion.update({
    where: { id: existing.id },
    data: parsed.data,
    select: suggestionSelect,
  });
  return NextResponse.json({ data });
}
