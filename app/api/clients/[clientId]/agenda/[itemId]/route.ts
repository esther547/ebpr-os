import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { startOfWeek } from "date-fns";
import { reassignAfterTimeChange } from "@/lib/runner-assign";

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

const patchSchema = z.object({
  // null clears the runner — the activity goes back to "needs a runner".
  runnerId: z.string().trim().min(1).nullable().optional(),
  deliverableId: z.string().optional(),
  eventDate: z.string().optional(),
  arrivalTime: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  itemType: z.string().optional(),
  notes: z.string().optional(),
  accompanistCount: z.number().int().min(0).optional(),
  monthNumber: z.number().int().min(1).optional().nullable(),
  agendaSequence: z.number().int().min(1).optional().nullable(),
  status: z
    .enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"])
    .optional(),
});

// PATCH — update a single agenda item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; itemId: string }> }
) {
  const user = await requireUser();
  const { clientId, itemId } = await params;

  const existing = await db.runnerAssignment.findFirst({
    where: { id: itemId, clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
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

  const d = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (d.runnerId !== undefined) {
    updateData.runnerId = d.runnerId || null;
    // A human picked this runner, so it is no longer the engine's to change.
    updateData.autoAssigned = false;
    updateData.assignedAt = d.runnerId ? new Date() : null;
  }
  if (d.deliverableId !== undefined) updateData.deliverableId = d.deliverableId;
  if (d.eventDate !== undefined) {
    const eventDate = parseDateInput(d.eventDate);
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Event date is invalid" }, { status: 400 });
    }
    updateData.eventDate = eventDate;
    updateData.weekOf = startOfWeek(eventDate, { weekStartsOn: 1 });
  }
  if (d.arrivalTime !== undefined) updateData.arrivalTime = d.arrivalTime ? new Date(d.arrivalTime) : null;
  if (d.eventTime !== undefined) updateData.eventTime = d.eventTime ? new Date(d.eventTime) : null;
  if (d.venueName !== undefined) updateData.venueName = d.venueName;
  if (d.venueAddress !== undefined) updateData.venueAddress = d.venueAddress;
  if (d.itemType !== undefined) updateData.itemType = d.itemType;
  if (d.notes !== undefined) updateData.notes = d.notes;
  if (d.accompanistCount !== undefined) updateData.accompanistCount = d.accompanistCount;
  if (d.monthNumber !== undefined) updateData.monthNumber = d.monthNumber;
  if (d.agendaSequence !== undefined) updateData.agendaSequence = d.agendaSequence;
  if (d.status !== undefined) updateData.status = d.status;

  const timeChanged =
    d.eventDate !== undefined || d.eventTime !== undefined || d.arrivalTime !== undefined;

  await db.runnerAssignment.update({ where: { id: itemId }, data: updateData });

  // An auto-assigned runner who no longer fits the new time is replaced by
  // whoever is available (and the team is told if nobody is).
  if (timeChanged && d.runnerId === undefined) {
    try {
      await reassignAfterTimeChange(itemId, user.id);
    } catch (err) {
      console.error("Re-assignment after time change failed:", err);
    }
  }

  const updated = await db.runnerAssignment.findUnique({
    where: { id: itemId },
    include: { runner: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: updated });
}

// DELETE — remove a single agenda item
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; itemId: string }> }
) {
  await requireUser();
  const { clientId, itemId } = await params;

  const existing = await db.runnerAssignment.findFirst({
    where: { id: itemId, clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });
  }

  await db.runnerAssignment.delete({ where: { id: itemId } });

  return NextResponse.json({ success: true });
}
