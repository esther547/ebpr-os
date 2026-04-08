import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  remindAt: z.string().min(1),
  type: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireUser();

  const clientId = req.nextUrl.searchParams.get("clientId");
  const upcoming = req.nextUrl.searchParams.get("upcoming") === "true";

  const where: any = { isDone: false };
  if (clientId) where.clientId = clientId;
  if (upcoming) where.remindAt = { gte: new Date() };

  const reminders = await db.reminder.findMany({
    where,
    orderBy: { remindAt: "asc" },
    take: 50,
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ data: reminders });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const reminder = await db.reminder.create({
    data: {
      clientId: parsed.data.clientId,
      createdById: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      remindAt: new Date(parsed.data.remindAt),
      type: parsed.data.type,
    },
  });

  return NextResponse.json({ data: reminder }, { status: 201 });
}
