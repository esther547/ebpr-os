import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyClientPautaChanges, notifyClientPautaRemoved } from "@/lib/client-notify";
import { assignPeriod, placeNewUnit } from "@/lib/service-periods";

import { mergeInternalNotes, splitClientNotes } from "@/lib/client-safe-notes";
import { miamiWeekOf } from "@/app/api/deliverables/_lib/agenda-sync";
import { z } from "zod";
import { reassignAfterTimeChange } from "@/lib/runner-assign";
import { notifyRunnerOfChanges, notifyRunnersOpenActivity, snapshotSelect } from "@/lib/runner-notify";
import { checkClientDate, dayKeyOf } from "@/lib/client-availability";

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

const patchSchema = z.object({
  // null clears the runner — the activity goes back to "needs a runner".
  runnerId: z.string().trim().min(1).nullable().optional(),
  eventName: z.string().trim().min(1).max(200).optional(),
  deliverableId: z.string().optional(),
  eventDate: z.string().optional(),
  arrivalTime: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  itemType: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().nullable().optional(),
  accompanistCount: z.number().int().min(0).optional(),
  monthNumber: z.number().int().min(1).optional().nullable(),
  /** Service period (null = pending review). Changing the event date never changes it. */
  periodId: z.string().nullable().optional(),
  coversPeriod: z.boolean().optional(),
  periodNote: z.string().trim().max(500).nullable().optional(),
  /** Goals this pauta is worth (1 by default). */
  goalValue: z.number().int().min(1).max(20).optional(),
  isGold: z.boolean().optional(),
  /** false = the proposal became a confirmed opportunity (it starts counting). */
  isProposal: z.boolean().optional(),
  agendaSequence: z.number().int().min(1).optional().nullable(),
  status: z
    .enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"])
    .optional(),
  /** true = the client cancelled last minute: runner freed, stays in the talent's agenda as "No asistió", still counts. */
  cancelLastMinute: z.boolean().optional(),
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
  const before = await db.runnerAssignment.findUnique({ where: { id: itemId }, select: snapshotSelect });

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
  if (d.eventName !== undefined) updateData.eventName = d.eventName;
  if (d.eventDate !== undefined) {
    const eventDate = parseDateInput(d.eventDate);
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Event date is invalid" }, { status: 400 });
    }
    updateData.eventDate = eventDate;
    updateData.weekOf = miamiWeekOf(eventDate);
  }

  // Client availability. Moving the item onto an OFF day is refused; a TRAVEL day
  // (or an unchanged day that is now OFF) saves with a warning.
  const effectiveEventDate = (updateData.eventDate as Date | undefined) ?? existing.eventDate;
  const availability = await checkClientDate(clientId, effectiveEventDate);
  const dayMoved =
    d.eventDate !== undefined && dayKeyOf(effectiveEventDate) !== dayKeyOf(existing.eventDate);
  if (availability.blocked && dayMoved) {
    return NextResponse.json({ error: availability.warning }, { status: 409 });
  }
  if (d.arrivalTime !== undefined) updateData.arrivalTime = d.arrivalTime ? new Date(d.arrivalTime) : null;
  if (d.eventTime !== undefined) updateData.eventTime = d.eventTime ? new Date(d.eventTime) : null;
  if (d.venueName !== undefined) updateData.venueName = d.venueName;
  if (d.venueAddress !== undefined) updateData.venueAddress = d.venueAddress;
  if (d.itemType !== undefined) updateData.itemType = d.itemType;
  if (d.periodId !== undefined || d.coversPeriod !== undefined || d.periodNote !== undefined || d.goalValue !== undefined || d.isGold !== undefined) {
    if (d.periodId) {
      const ok = await db.servicePeriod.findFirst({ where: { id: d.periodId, clientId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Período no encontrado" }, { status: 400 });
    }
    await assignPeriod({ pautaId: itemId }, d.periodId !== undefined ? d.periodId : (existing.periodId ?? null), { coversPeriod: d.coversPeriod, periodNote: d.periodNote, goalValue: d.goalValue, isGold: d.isGold, ...(d.periodId !== undefined ? { source: "manual" as const } : {}) });
  }
  if (d.notes !== undefined || d.internalNotes !== undefined) {
    // Contact-looking lines typed into the client-visible field move to internal notes.
    const split = d.notes !== undefined ? splitClientNotes(d.notes) : null;
    if (split) updateData.notes = split.client ?? "";
    const baseInternal = d.internalNotes !== undefined ? d.internalNotes : (await db.runnerAssignment.findUnique({ where: { id: itemId }, select: { internalNotes: true } }))?.internalNotes ?? null;
    updateData.internalNotes = mergeInternalNotes(baseInternal, split?.internal);
  }
  if (d.accompanistCount !== undefined) updateData.accompanistCount = d.accompanistCount;
  if (d.monthNumber !== undefined) updateData.monthNumber = d.monthNumber;
  if (d.isProposal !== undefined) updateData.isProposal = d.isProposal;
  if (d.agendaSequence !== undefined) updateData.agendaSequence = d.agendaSequence;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.cancelLastMinute !== undefined) { updateData.cancelLastMinute = d.cancelLastMinute; if (d.cancelLastMinute) updateData.status = "CANCELLED"; }
  if (d.status !== undefined && d.status !== "CANCELLED" && d.cancelLastMinute === undefined) updateData.cancelLastMinute = false;

  const timeChanged =
    d.eventDate !== undefined || d.eventTime !== undefined || d.arrivalTime !== undefined;

  await db.runnerAssignment.update({ where: { id: itemId }, data: updateData });
  // A proposal that just became a confirmed opportunity starts counting: place it now.
  if (d.isProposal === false && existing.isProposal) await placeNewUnit(clientId, { pautaId: itemId }, new Date());

  // An auto-assigned runner who no longer fits the new time is replaced by
  // whoever is available (and the team is told if nobody is).
  if (timeChanged && d.runnerId === undefined) {
    try {
      await reassignAfterTimeChange(itemId, user.id);
    } catch (err) {
      console.error("Re-assignment after time change failed:", err);
    }
  }

  // The runner on this pauta learns exactly what changed (or the new runner that they got it);
  // a pauta left without a runner is broadcast to every runner.
  try {
    if (before) {
      if (before) await notifyClientPautaChanges(before).catch((err) => console.error("notifyClientPautaChanges:", err));
      const r = await notifyRunnerOfChanges(before, user.name);
      if (!r.notified && before.runnerId && d.runnerId === null) await notifyRunnersOpenActivity(itemId);
    }
  } catch (err) {
    console.error("Runner notification failed:", err);
  }

  const updated = await db.runnerAssignment.findUnique({
    where: { id: itemId },
    include: { runner: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: updated, warning: availability.warning });
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

  const snap = await db.runnerAssignment.findUnique({ where: { id: itemId }, select: snapshotSelect });
  await db.runnerAssignment.delete({ where: { id: itemId } });
  if (snap) await notifyClientPautaRemoved(snap).catch((err) => console.error("notifyClientPautaRemoved:", err));


  return NextResponse.json({ success: true });
}
