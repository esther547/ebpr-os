import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveWeekKey, weekOfInstant } from "@/lib/priorities";
import { authorizeSuggestions, jsonError } from "@/lib/client-suggestions";

export const dynamic = "force-dynamic";

/**
 * POST /api/clients/:clientId/suggestions/:id/to-priority
 * Adds the suggestion as a line of the client's weekly priorities for the
 * current Miami week. 409 when it is already on this week's list.
 */
export async function POST(_req: Request, { params }: { params: { clientId: string; id: string } }) {
  const auth = await authorizeSuggestions();
  if (auth.error) return auth.error;

  const suggestion = await db.clientSuggestion.findFirst({
    where: { id: params.id, clientId: params.clientId },
    select: { id: true, title: true, rationale: true, timing: true, status: true, priorityId: true },
  });
  if (!suggestion) return jsonError("Sugerencia no encontrada", 404);

  const weekKey = resolveWeekKey();
  const weekOf = weekOfInstant(weekKey);
  const title = suggestion.title.length > 300 ? suggestion.title.slice(0, 299).trimEnd() + "…" : suggestion.title;

  const existing = await db.weeklyPriority.findFirst({
    where: {
      weekOf,
      clientId: params.clientId,
      list: "TEAM",
      OR: [
        ...(suggestion.priorityId ? [{ id: suggestion.priorityId }] : []),
        { title: { equals: title, mode: "insensitive" as const } },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Esta sugerencia ya está en las prioridades de esta semana", priorityId: existing.id },
      { status: 409 }
    );
  }

  const notesRaw = suggestion.timing ? `${suggestion.rationale}\n\nCuándo: ${suggestion.timing}` : suggestion.rationale;
  const notes = notesRaw.length > 2000 ? notesRaw.slice(0, 1999) + "…" : notesRaw;

  const priority = await db.$transaction(async (tx) => {
    const last = await tx.weeklyPriority.aggregate({
      where: { weekOf, clientId: params.clientId, list: "TEAM" },
      _max: { order: true },
    });
    const created = await tx.weeklyPriority.create({
      data: {
        weekOf,
        clientId: params.clientId,
        title,
        notes,
        order: (last._max.order ?? -1) + 1,
        createdById: auth.user.id,
      },
      select: { id: true, title: true, weekOf: true },
    });
    await tx.clientSuggestion.update({
      where: { id: suggestion.id },
      // Sent to this week's list = the team is on it.
      data: { priorityId: created.id, ...(suggestion.status === "NEW" ? { status: "IN_PROGRESS" as const } : {}) },
    });
    return created;
  });

  return NextResponse.json({ data: { priorityId: priority.id, week: weekKey, priority } }, { status: 201 });
}
