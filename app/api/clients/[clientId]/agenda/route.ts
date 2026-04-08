import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { startOfWeek, startOfDay, endOfDay } from "date-fns";

const agendaItemSchema = z.object({
  runnerId: z.string().optional(),
  deliverableId: z.string().optional(),
  eventName: z.string().optional(),
  date: z.string().optional(),
  eventDate: z.string().optional(),
  arrivalTime: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  location: z.string().optional(),
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
  const year = searchParams.get("year");

  const now = new Date();
  const startYear = year
    ? new Date(`${year}-01-01`)
    : new Date(`${now.getFullYear()}-01-01`);
  const endYear = year
    ? new Date(`${Number(year) + 1}-01-01`)
    : new Date(`${now.getFullYear() + 1}-01-01`);

  const items = await db.runnerAssignment.findMany({
    where: {
      clientId,
      eventDate: { gte: startYear, lt: endYear },
    },
    orderBy: [{ eventDate: "asc" }],
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: items });
}

// POST — create a new agenda item (runner assignment)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const user = await requireUser();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
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
  const dateStr = data.eventDate || data.date;
  if (!dateStr) {
    return NextResponse.json({ error: "Event date is required" }, { status: 400 });
  }

  const eventDate = new Date(dateStr);
  const weekOf = startOfWeek(eventDate, { weekStartsOn: 1 });
  const eventName = data.eventName || data.itemType || "Appearance";

  // ── Conflict Detection ──────────────────────────────────
  let conflictWarning: string | null = null;
  if (data.runnerId) {
    const sameDayAssignments = await db.runnerAssignment.findMany({
      where: {
        runnerId: data.runnerId,
        eventDate: {
          gte: startOfDay(eventDate),
          lte: endOfDay(eventDate),
        },
        status: { not: "CANCELLED" },
      },
    });

    if (sameDayAssignments.length > 0) {
      const runner = await db.user.findUnique({
        where: { id: data.runnerId },
        select: { name: true },
      });
      conflictWarning = `Warning: ${runner?.name || "Runner"} already has ${sameDayAssignments.length} assignment(s) on this day`;
    }
  }

  const item = await db.runnerAssignment.create({
    data: {
      clientId,
      runnerId: data.runnerId ?? "placeholder",
      deliverableId: data.deliverableId,
      eventDate,
      eventName,
      weekOf,
      location: data.location,
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

  // Log activity
  await db.activityLog.create({
    data: {
      clientId,
      userId: user.id,
      action: "runner_assigned",
      description: `Assigned ${item.runner.name} to "${eventName}" for ${client.name}`,
    },
  });

  return NextResponse.json({
    data: item,
    conflictWarning,
  }, { status: 201 });
}
