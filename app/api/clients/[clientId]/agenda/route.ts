import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";
import { startOfWeek, startOfDay, endOfDay } from "date-fns";

const agendaItemSchema = z.object({
  // Optional: an activity with no runner yet is a valid agenda item — it simply
  // "needs a runner" until the auto-scheduler (or a human) picks one.
  runnerId: z.string().trim().min(1).optional().nullable(),
  deliverableId: z.string().optional().nullable(),
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

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

// GET — fetch all agenda items for a client
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageRunners(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, status: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  // Business rule: paused clients get no new runner assignments
  if (client.status === "PAUSED" || client.status === "CHURNED") {
    return NextResponse.json(
      { error: `${client.name} is ${client.status.toLowerCase()} — reactivate the client before assigning runners.` },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = agendaItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
          .join("; "),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const dateStr = data.eventDate || data.date;
  if (!dateStr) {
    return NextResponse.json({ error: "Event date is required" }, { status: 400 });
  }

  const eventDate = parseDateInput(dateStr);
  if (isNaN(eventDate.getTime())) {
    return NextResponse.json({ error: "Event date is invalid" }, { status: 400 });
  }
  const weekOf = startOfWeek(eventDate, { weekStartsOn: 1 });
  const eventName = data.eventName || data.itemType || "Appearance";

  let runner: { id: string; name: string } | null = null;
  if (data.runnerId) {
    const found = await db.user.findUnique({
      where: { id: data.runnerId },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (!found || found.role !== "RUNNER" || !found.isActive) {
      return NextResponse.json({ error: "Selected runner was not found" }, { status: 400 });
    }
    runner = { id: found.id, name: found.name };
  }

  if (data.deliverableId) {
    const del = await db.deliverable.findUnique({
      where: { id: data.deliverableId },
      select: { clientId: true },
    });
    if (!del || del.clientId !== clientId) {
      return NextResponse.json({ error: "Deliverable does not belong to this client" }, { status: 400 });
    }
  }

  // ── Conflict Detection (only meaningful once a runner is chosen) ──
  let conflictWarning: string | null = null;
  if (runner) {
    const sameDayAssignments = await db.runnerAssignment.count({
      where: {
        runnerId: runner.id,
        eventDate: {
          gte: startOfDay(eventDate),
          lte: endOfDay(eventDate),
        },
        status: { not: "CANCELLED" },
      },
    });
    if (sameDayAssignments > 0) {
      conflictWarning = `Warning: ${runner.name} already has ${sameDayAssignments} assignment(s) on this day`;
    }
  }

  try {
    const item = await db.runnerAssignment.create({
      data: {
        clientId,
        runnerId: runner?.id ?? null,
        assignedAt: runner ? new Date() : null,
        deliverableId: data.deliverableId || null,
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

    await db.activityLog.create({
      data: {
        clientId,
        deliverableId: data.deliverableId || null,
        userId: user.id,
        action: runner ? "runner_assigned" : "agenda_item_created",
        description: runner
          ? `Assigned ${runner.name} to "${eventName}" for ${client.name}`
          : `Added "${eventName}" to ${client.name}'s agenda — needs a runner`,
      },
    });

    return NextResponse.json({ data: item, conflictWarning }, { status: 201 });
  } catch (err) {
    console.error("POST /api/clients/[clientId]/agenda failed:", err);
    return NextResponse.json({ error: "Could not create agenda item" }, { status: 500 });
  }
}
