import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManagePressReleases } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export async function GET() {
  const user = await requireUser();
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
  const user = await requireUser();
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const release = await db.pressRelease.create({
    data: {
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      content: parsed.data.content,
      createdById: user.id,
      tags: parsed.data.tags || [],
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
