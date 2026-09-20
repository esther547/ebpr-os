import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { tzMidnight } from "@/components/runners/miami-time";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  // "yyyy-MM-dd" (what the date input sends) or a full ISO timestamp
  date: z.string().min(1),
  hours: z.coerce.number().positive().max(24),
  description: z.string().trim().max(500).optional(),
  clientName: z.string().trim().max(200).optional(),
  assignmentId: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();

  // Runners only ever see their own hours
  const where = user.role === "RUNNER" ? { runnerId: user.id } : {};

  const rows = await db.runnerHours.findMany({
    where,
    orderBy: { date: "desc" },
    take: 100,
    include: { runner: { select: { id: true, name: true } } },
  });

  // Decimal -> number for JSON consumers
  const data = rows.map((h) => ({ ...h, hours: Number(h.hours) }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // A bare "yyyy-MM-dd" would otherwise parse as UTC midnight and display as
  // the previous day in Miami. Store it as Miami midnight instead.
  const raw = parsed.data.date;
  const date = DAY_KEY.test(raw) ? tzMidnight(raw) : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: { date: ["Invalid date"] } }, { status: 400 });
  }

  // Runners can only log hours against their own assignments
  if (parsed.data.assignmentId) {
    const assignment = await db.runnerAssignment.findUnique({
      where: { id: parsed.data.assignmentId },
      select: { runnerId: true },
    });
    if (!assignment || (user.role === "RUNNER" && assignment.runnerId !== user.id)) {
      return NextResponse.json({ error: { assignmentId: ["Assignment not found"] } }, { status: 404 });
    }
  }

  const entry = await db.runnerHours.create({
    data: {
      runnerId: user.id,
      assignmentId: parsed.data.assignmentId,
      date,
      hours: parsed.data.hours,
      description: parsed.data.description || null,
      clientName: parsed.data.clientName || null,
    },
  });

  return NextResponse.json({ data: { ...entry, hours: Number(entry.hours) } }, { status: 201 });
}
