import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authorizeEvents,
  eventErrorResponse,
  eventSelect,
  invalidDayMessage,
  updateEventSchema,
  zodMessage,
} from "@/lib/industry-events";

export const dynamic = "force-dynamic";

/** PATCH /api/events/[id] — edit any subset of the event's fields. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeEvents();
  if (auth.error) return auth.error;
  const { id } = await params;

  const existing = await db.industryEvent.findUnique({
    where: { id },
    select: { month: true, day: true, year: true },
  });
  if (!existing) return eventErrorResponse("Evento no encontrado", 404);

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return eventErrorResponse("El cuerpo de la petición no es JSON válido");

  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) return eventErrorResponse(zodMessage(parsed.error.issues));

  // Only keys actually sent are written (zod turns omitted optional text into null).
  const sent = body && typeof body === "object" ? new Set(Object.keys(body)) : new Set<string>();
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([k]) => sent.has(k))
  ) as typeof parsed.data;
  if (Object.keys(data).length === 0) return eventErrorResponse("No hay cambios para guardar");
  if ("name" in data && !data.name) return eventErrorResponse("El nombre es obligatorio");

  const month = data.month ?? existing.month;
  const day = "day" in data ? data.day ?? null : existing.day;
  const year = "year" in data ? data.year ?? null : existing.year;
  const dayError = invalidDayMessage(month, day, year);
  if (dayError) return eventErrorResponse(dayError);

  const event = await db.industryEvent.update({ where: { id }, data, select: eventSelect });
  return NextResponse.json({ data: event });
}

/** DELETE /api/events/[id] — remove the event (and its reminder history). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeEvents();
  if (auth.error) return auth.error;
  const { id } = await params;

  const existing = await db.industryEvent.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return eventErrorResponse("Evento no encontrado", 404);

  await db.industryEvent.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
