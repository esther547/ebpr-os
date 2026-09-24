import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayKeyInTz } from "@/components/runners/miami-time";
import { nextOccurrenceKey } from "@/components/events/helpers";
import {
  authorizeEvents,
  createOpportunityPriority,
  eventErrorResponse,
} from "@/lib/industry-events";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/priority — add "Trabajar oportunidad: <name> (<mes>)"
 * to this week's General priorities now. 409 when it is already there.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeEvents();
  if (auth.error) return auth.error;
  const { id } = await params;

  const event = await db.industryEvent.findUnique({ where: { id } });
  if (!event) return eventErrorResponse("Evento no encontrado", 404);

  const now = new Date();
  const occursKey = nextOccurrenceKey(event, dayKeyInTz(now));
  if (!occursKey) return eventErrorResponse("Este evento ya pasó");

  const result = await createOpportunityPriority(event, occursKey, auth.user.id, now);
  if (!result.created) {
    return eventErrorResponse("Esta oportunidad ya está en las prioridades de esta semana", 409);
  }
  return NextResponse.json({ data: { priorityId: result.id } }, { status: 201 });
}
