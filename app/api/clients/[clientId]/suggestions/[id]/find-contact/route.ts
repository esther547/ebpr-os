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
 * POST /api/clients/:clientId/suggestions/:id/find-contact
 * Internal journalists + Claude web research for who could open the door to
 * this suggestion. Saves the result as its contact (contactSource "AI"; notes
 * the team wrote stay on top) and returns { contactNotes, contactSource,
 * contactUpdatedAt, raw }.
 */
export async function POST(_req: Request, { params }: { params: { clientId: string; id: string } }) {
  const auth = await authorizeContacts();
  if (auth.error) return auth.error;

  if (!anthropicConfigured()) return contactJsonError(MISSING_KEY_MESSAGE, 503);

  const suggestion = await db.clientSuggestion.findFirst({
    where: { id: params.id, clientId: params.clientId },
    select: {
      id: true,
      title: true,
      rationale: true,
      category: true,
      timing: true,
      contactNotes: true,
      contactSource: true,
      client: { select: { name: true, industry: true } },
    },
  });
  if (!suggestion) return contactJsonError("Sugerencia no encontrada", 404);

  try {
    const { contactNotes, raw } = await findContacts({
      clientName: suggestion.client.name,
      clientIndustry: suggestion.client.industry,
      targetTitle: suggestion.title,
      category: suggestion.category,
      notes: [suggestion.rationale, suggestion.timing ? `Timing: ${suggestion.timing}` : ""].filter(Boolean).join(" "),
    });
    const saved = await db.clientSuggestion.update({
      where: { id: suggestion.id },
      data: { contactNotes: mergeAiNotes(suggestion, contactNotes), contactSource: "AI", contactUpdatedAt: new Date() },
      select: contactSelect,
    });
    return NextResponse.json({ ...saved, raw });
  } catch (err) {
    const { status, error } = contactErrorResponse(err);
    if (status >= 500) console.error("POST /suggestions/find-contact failed:", err);
    return contactJsonError(error, status);
  }
}
