import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const comment = await db.comment.create({
    data: {
      deliverableId: id,
      userId: user.id,
      content: parsed.data.content,
    },
  });

  return NextResponse.json({ data: comment }, { status: 201 });
}
