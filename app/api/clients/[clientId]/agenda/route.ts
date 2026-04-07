import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { startOfWeek } from "date-fns";

const agendaItemSchema = z.object({
  runnerId: z.string().optional(),
  deliverableId: z.string().optional(),
  date: z.string(),
  arrivalTime: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  itemType: z.string().optional(),
  notes: z.string().optional(),
  accompanistCount: z.number().int().min(0).optional().default(0),
  monthNumber: z.number().int().min(1).optional().nullable(),
  agendaSequence: z.number().int().min(1).optional().nullable(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional().default("SCHEDULED"),
});

// GET — fetch all agenda items for a client
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  await requireUser();
  const { clientId } = await params;

  const { searchParams } = new URL(req.url);
  const monthNumber = searchParams.get("month");
  const year = searchParams.get("year");

  const now = new Date();
  const startOfYear = year
    ? new Date(`${year}-01-01`)
    : new Date(`${now.getFullYear()}-01-01`);
  const endOfYear = year
    ? new Date(`${Number(year) + 1}-01-01`)
    : new Date(`${now.getFullYear() + 1}-01-01`);

  const items = await db.runnerAssignment.findMany({
    where: {
      clientId,
      eventDate: { gte: startOfYear, lt: endOfYear },
      ...(monthNumber ? { monthNumber: Number(monthNumber) } : {}),
    },
    orderBy: [{ monthNumber: "asc" }, { agendaSequence: "asc" }, { eventDate: "asc" }],
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: items });
}

// POST — create a new agenda item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  await requireUser();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = agendaItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const eventDate = new Date(data.date);
  const weekOf = startOfWeek(eventDate, { weekStartsOn: 1 });

  const item = await db.runnerAssignment.create({
    data: {
      clientId,
      runnerId: data.runnerId ?? "placeholder",
      eventDate,
      eventName: data.notes ?? data.itemType ?? "Appearance",
      weekOf,
      arrivalTime: data.arrivalTime ? new Date(data.arrivalTime) : null,
      eventTime: data.eventTime ? new Date(data.eventTime) : null,
      venueName: data.venueName,
      venueAddress: data.venueAddress,
      itemType: data.itemType,
      notes: data.notes,
      accompanistCount: data.accompanistCount,
      monthNumber: data.monthNumber ?? null,
      agendaSequence: data.agendaSequence ?? null,
      status: data.status,
    },
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
