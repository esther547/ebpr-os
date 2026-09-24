import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authorizeEvents,
  createEventSchema,
  eventErrorResponse,
  eventSelect,
  invalidDayMessage,
  upcomingEvents,
  zodMessage,
} from "@/lib/industry-events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events?days=365 — active events whose next occurrence is within
 * `days` days (1–730, default 365), sorted by date, each with its reminder
 * day and whether that occurrence was already reminded.
 */
export async function GET(req: NextRequest) {
  const auth = await authorizeEvents();
  if (auth.error) return auth.error;

  const raw = req.nextUrl.searchParams.get("days");
  let days = 365;
  if (raw !== null) {
    days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 730) {
      return eventErrorResponse("days debe ser un número entero entre 1 y 730");
    }
  }

  const data = await upcomingEvents(days);
  return NextResponse.json({ data, days });
}

/** POST /api/events — add an event to the calendar. */
export async function POST(req: NextRequest) {
  const auth = await authorizeEvents();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return eventErrorResponse("El cuerpo de la petición no es JSON válido");

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) return eventErrorResponse(zodMessage(parsed.error.issues));

  const { day = null, year = null, ...rest } = parsed.data;
  const dayError = invalidDayMessage(rest.month, day, year);
  if (dayError) return eventErrorResponse(dayError);

  const event = await db.industryEvent.create({
    data: { ...rest, day, year, createdById: auth.user.id },
    select: eventSelect,
  });
  return NextResponse.json({ data: event }, { status: 201 });
}
