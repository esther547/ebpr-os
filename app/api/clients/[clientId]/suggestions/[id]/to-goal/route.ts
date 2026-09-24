import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentCycle } from "@/lib/cycles";
import { authorizeSuggestions, deliverableTypeFor, jsonError, readJson } from "@/lib/client-suggestions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assigneeId: z.string().trim().min(1).nullable().optional(),
});

/**
 * POST /api/clients/:clientId/suggestions/:id/to-goal { assigneeId? }
 * Turns the suggestion into a goal (Deliverable) in OUTREACH, tagged with the
 * client's current cycle like POST /api/deliverables does without a due date.
 * The goal is assigned to `assigneeId` or, by default, to the current user.
 */
export async function POST(req: Request, { params }: { params: { clientId: string; id: string } }) {
  const auth = await authorizeSuggestions();
  if (auth.error) return auth.error;
  const user = auth.user;

  const read = await readJson(req);
  if (!read.ok) return jsonError("El cuerpo de la petición no es JSON válido");
  const parsed = bodySchema.safeParse(read.body);
  if (!parsed.success) return jsonError("Responsable no válido");

  const suggestion = await db.clientSuggestion.findFirst({
    where: { id: params.id, clientId: params.clientId },
    select: { id: true, title: true, rationale: true, timing: true, category: true, deliverableId: true, status: true },
  });
  if (!suggestion) return jsonError("Sugerencia no encontrada", 404);

  if (suggestion.deliverableId) {
    const goal = await db.deliverable.findUnique({ where: { id: suggestion.deliverableId }, select: { id: true } });
    if (goal) return NextResponse.json({ error: "Esta sugerencia ya se convirtió en meta", goalId: goal.id }, { status: 409 });
  }

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, status: true, cycleDay: true },
  });
  if (!client) return jsonError("Cliente no encontrado", 404);
  // Same business rule as POST /api/deliverables: paused/churned clients get no new goals.
  if (client.status === "PAUSED" || client.status === "CHURNED") {
    return jsonError(`${client.name} está ${client.status === "PAUSED" ? "en pausa" : "inactivo"}: reactiva el cliente antes de agregar metas.`, 409);
  }

  const assigneeId = parsed.data.assigneeId || user.id;
  if (assigneeId !== user.id) {
    const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true, isActive: true } });
    if (!assignee || !assignee.isActive) return jsonError("Responsable no encontrado");
  }

  // No due date yet -> the client's current goal cycle (fecha de corte).
  const cycle = currentCycle(client.cycleDay);
  const title = suggestion.title.length > 200 ? suggestion.title.slice(0, 199).trimEnd() + "…" : suggestion.title;
  const notes = suggestion.timing ? `${suggestion.rationale}\n\nCuándo: ${suggestion.timing}` : suggestion.rationale;

  const goal = await db.$transaction(async (tx) => {
    const created = await tx.deliverable.create({
      data: {
        clientId: client.id,
        title,
        type: deliverableTypeFor(suggestion.category),
        status: "OUTREACH",
        assigneeId,
        month: cycle.month,
        year: cycle.year,
        notes,
        isClientVisible: true,
      },
      select: { id: true, title: true, month: true, year: true, status: true, type: true, assigneeId: true },
    });
    await tx.clientSuggestion.update({
      where: { id: suggestion.id },
      data: { deliverableId: created.id, status: "IN_PROGRESS" },
    });
    await tx.activityLog.create({
      data: {
        clientId: client.id,
        deliverableId: created.id,
        userId: user.id,
        action: "deliverable_created",
        description: `Created deliverable "${created.title}" from a suggestion`,
      },
    });
    return created;
  });

  return NextResponse.json({ data: { goalId: goal.id, goal } }, { status: 201 });
}
