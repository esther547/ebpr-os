import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const body = await req.json();

  const reminder = await db.reminder.update({
    where: { id },
    data: body,
  });

  return NextResponse.json({ data: reminder });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  await db.reminder.update({
    where: { id },
    data: { isDone: true },
  });

  return NextResponse.json({ message: "Reminder completed" });
}
