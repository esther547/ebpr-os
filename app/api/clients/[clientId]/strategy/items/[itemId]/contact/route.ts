import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authorizeContacts,
  contactJsonError,
  contactPatchSchema,
  contactSelect,
  manualContactData,
  readJsonBody,
} from "@/lib/contact-finder";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/clients/:clientId/strategy/items/:itemId/contact { contactNotes }
 * Manual save of the internal "Contacto / fuente" (contactSource "TEAM").
 * An empty note clears it. Internal only: never shown to the client.
 */
export async function PATCH(req: Request, { params }: { params: { clientId: string; itemId: string } }) {
  const auth = await authorizeContacts();
  if (auth.error) return auth.error;

  const read = await readJsonBody(req);
  if (!read.ok) return contactJsonError("El cuerpo de la petición no es JSON válido");
  const parsed = contactPatchSchema.safeParse(read.body);
  if (!parsed.success) return contactJsonError(parsed.error.issues.map((i) => i.message).join("; "));

  const item = await db.strategyItem.findFirst({
    where: { id: params.itemId, clientId: params.clientId },
    select: { id: true },
  });
  if (!item) return contactJsonError("Elemento de la estrategia no encontrado", 404);

  const saved = await db.strategyItem.update({
    where: { id: item.id },
    data: manualContactData(parsed.data.contactNotes),
    select: contactSelect,
  });
  return NextResponse.json(saved);
}
