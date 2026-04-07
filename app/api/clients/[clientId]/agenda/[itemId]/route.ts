import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  runnerId: z.string().optional(),
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
  await requireUser();
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
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (d.runnerId !== undefined) updateData.runnerId = d.runnerId;
  if (d.deliverableId !== undefined) updateData.deliverableId = d.deliverableId;
  if (d.eventDate !== undefined) updateData.eventDate = new Date(d.eventDate);
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

  const updated = await db.runnerAssignment.update({
    where: { id: itemId },
    data: updateData,
    include: {
      runner: { select: { id: true, name: true } },
    },
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
