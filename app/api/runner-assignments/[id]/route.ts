import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { db } from "@/lib/db";
import { reassignAfterTimeChange } from "@/lib/runner-assign";
import { dayKeyInTz, tzMidnight, weekStartKey } from "@/components/runners/miami-time";

export const dynamic = "force-dynamic";

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

const updateSchema = z.object({
  // null clears the runner — the activity goes back to "needs a runner".
  runnerId: z.string().trim().min(1).nullable().optional(),
  eventName: z.string().trim().min(1).max(200).optional(),
  eventDate: z.string().optional(),
  arrivalTime: z.string().nullable().optional(),
  eventTime: z.string().nullable().optional(),
  venueName: z.string().nullable().optional(),
  venueAddress: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  itemType: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
});

type Params = { params: { id: string } };

async function handleUpdate(req: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageRunners(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.runnerAssignment.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
          .join("; "),
      },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const data: Record<string, unknown> = {};

  if (d.runnerId !== undefined) {
    if (d.runnerId) {
      const runner = await db.user.findUnique({
        where: { id: d.runnerId },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!runner || runner.role !== "RUNNER" || !runner.isActive) {
        return NextResponse.json({ error: "Selected runner was not found" }, { status: 400 });
      }
    }
    data.runnerId = d.runnerId || null;
    // A human picked this runner, so the engine will not second-guess it.
    data.autoAssigned = false;
    data.assignedAt = d.runnerId ? new Date() : null;
  }

  if (d.eventDate !== undefined) {
    const eventDate = parseDateInput(d.eventDate);
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Event date is invalid" }, { status: 400 });
    }
    data.eventDate = eventDate;
    data.weekOf = tzMidnight(weekStartKey(dayKeyInTz(eventDate)));
  }
  for (const key of ["arrivalTime", "eventTime"] as const) {
    if (d[key] !== undefined) {
      const value = d[key];
      if (!value) {
        data[key] = null;
      } else {
        const parsedTime = new Date(value);
        if (isNaN(parsedTime.getTime())) {
          return NextResponse.json({ error: `${key} is invalid` }, { status: 400 });
        }
        data[key] = parsedTime;
      }
    }
  }
  for (const key of ["eventName", "venueName", "venueAddress", "location", "itemType", "notes", "status"] as const) {
    if (d[key] !== undefined) data[key] = d[key];
  }

  await db.runnerAssignment.update({ where: { id: params.id }, data });

  // The time moved: an auto-assigned runner who is no longer available gets
  // replaced by whoever is, and the team is notified if nobody is.
  const timeChanged =
    d.eventDate !== undefined || d.eventTime !== undefined || d.arrivalTime !== undefined;
  let reassigned = false;
  if (timeChanged && d.runnerId === undefined) {
    try {
      const result = await reassignAfterTimeChange(params.id, user.id);
      reassigned = result.changed;
    } catch (err) {
      console.error("Re-assignment after time change failed:", err);
    }
  }

  const updated = await db.runnerAssignment.findUnique({
    where: { id: params.id },
    include: { runner: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: updated, reassigned });
}

export const PATCH = handleUpdate;
export const PUT = handleUpdate;

export async function GET(_req: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignment = await db.runnerAssignment.findUnique({
    where: { id: params.id },
    include: { runner: { select: { id: true, name: true } } },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  // Runners only ever see their own rows.
  if (user.role === "RUNNER" && assignment.runnerId !== user.id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: assignment });
}
