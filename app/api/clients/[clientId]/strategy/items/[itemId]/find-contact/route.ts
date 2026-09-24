import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  MISSING_KEY_MESSAGE,
  anthropicConfigured,
  authorizeContacts,
  contactErrorResponse,
  contactJsonError,
  contactSelect,
  findContacts,
  mergeAiNotes,
} from "@/lib/contact-finder";

export const dynamic = "force-dynamic";
// Web research usually takes 20–60 s.
export const maxDuration = 120;

/**
 * POST /api/clients/:clientId/strategy/items/:itemId/find-contact
 * Internal journalists + Claude web research for who could open the door to
 * this target. Saves the result as the item's contact (contactSource "AI";
 * notes the team wrote stay on top) and returns { contactNotes, contactSource,
 * contactUpdatedAt, raw }.
 */
export async function POST(_req: Request, { params }: { params: { clientId: string; itemId: string } }) {
  const auth = await authorizeContacts();
  if (auth.error) return auth.error;

  if (!anthropicConfigured()) return contactJsonError(MISSING_KEY_MESSAGE, 503);

  const item = await db.strategyItem.findFirst({
    where: { id: params.itemId, clientId: params.clientId },
    select: {
      id: true,
      title: true,
      targetName: true,
      category: true,
      notes: true,
      eventLocation: true,
      contactNotes: true,
      contactSource: true,
      client: { select: { name: true, industry: true } },
    },
  });
  if (!item) return contactJsonError("Elemento de la estrategia no encontrado", 404);

  try {
    const { contactNotes, raw } = await findContacts({
      clientName: item.client.name,
      clientIndustry: item.client.industry,
      targetTitle: item.title,
      targetName: item.targetName,
      category: item.category,
      notes: item.notes,
      city: item.eventLocation,
    });
    const saved = await db.strategyItem.update({
      where: { id: item.id },
      data: { contactNotes: mergeAiNotes(item, contactNotes), contactSource: "AI", contactUpdatedAt: new Date() },
      select: contactSelect,
    });
    return NextResponse.json({ ...saved, raw });
  } catch (err) {
    const { status, error } = contactErrorResponse(err);
    if (status >= 500) console.error("POST /strategy/items/find-contact failed:", err);
    return contactJsonError(error, status);
  }
}
