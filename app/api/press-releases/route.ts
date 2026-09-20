import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManagePressReleases } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1, "Pick a client"),
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().min(1, "Content is required"),
  tags: z
    .array(z.string().trim())
    .optional()
    .transform((arr) => Array.from(new Set((arr ?? []).filter(Boolean)))),
});

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releases = await db.pressRelease.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: releases });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: first, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const release = await db.pressRelease.create({
    data: {
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      content: parsed.data.content,
      createdById: user.id,
      tags: parsed.data.tags,
    },
  });

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: parsed.data.clientId,
      action: "press_release_created",
      description: `Created press release: ${parsed.data.title}`,
    },
  });

  return NextResponse.json({ data: release }, { status: 201 });
}
