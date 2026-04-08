import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  date: z.string().min(1),
  hours: z.number().positive().max(24),
  description: z.string().optional(),
  clientName: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();

  const where = user.role === "RUNNER" ? { runnerId: user.id } : {};

  const hours = await db.runnerHours.findMany({
    where,
    orderBy: { date: "desc" },
    take: 100,
    include: { runner: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: hours });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const entry = await db.runnerHours.create({
    data: {
      runnerId: user.id,
      date: new Date(parsed.data.date),
      hours: parsed.data.hours,
      description: parsed.data.description,
      clientName: parsed.data.clientName,
    },
  });

  return NextResponse.json({ data: entry }, { status: 201 });
}
