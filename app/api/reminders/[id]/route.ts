import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  remindAt: z.string().optional(),
  type: z.string().nullable().optional(),
  isDone: z.boolean().optional(),
});

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const data: Prisma.ReminderUncheckedUpdateInput = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.description !== undefined) data.description = d.description;
  if (d.type !== undefined) data.type = d.type;
  if (d.isDone !== undefined) data.isDone = d.isDone;
  if (d.remindAt !== undefined) {
    const when = parseDateInput(d.remindAt);
    if (isNaN(when.getTime())) {
      return NextResponse.json({ error: "Reminder date is invalid" }, { status: 400 });
    }
    data.remindAt = when;
  }

  try {
    const reminder = await db.reminder.update({ where: { id }, data });
    return NextResponse.json({ data: reminder });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PUT /api/reminders/[id] failed:", err);
    return NextResponse.json({ error: "Could not update reminder" }, { status: 500 });
  }
}

// DELETE — marks the reminder as done (soft delete)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db.reminder.update({ where: { id }, data: { isDone: true } });
    return NextResponse.json({ message: "Reminder completed" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/reminders/[id] failed:", err);
    return NextResponse.json({ error: "Could not complete reminder" }, { status: 500 });
  }
}
