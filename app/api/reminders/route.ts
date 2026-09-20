import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

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
    return NextResponse.json({ error: zodMessage(parsed.error), details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (isNaN(parseDateInput(parsed.data.remindAt).getTime())) {
    return NextResponse.json({ error: "Reminder date is invalid" }, { status: 400 });
  }
  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const reminder = await db.reminder.create({
    data: {
      clientId: parsed.data.clientId,
      createdById: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      remindAt: parseDateInput(parsed.data.remindAt),
      type: parsed.data.type || null,
    },
  });

  return NextResponse.json({ data: reminder }, { status: 201 });
}
