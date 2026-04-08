import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManagePressReleases } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "SENT", "CANCELLED"]).optional(),
  scheduledDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const release = await db.pressRelease.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: release });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data: any = { ...parsed.data };

  // Auto-set dates on status changes
  if (parsed.data.status === "APPROVED") {
    data.approvedAt = new Date();
    data.approvedBy = user.name;
  }
  if (parsed.data.scheduledDate) {
    data.scheduledDate = new Date(parsed.data.scheduledDate);
  }
  if (parsed.data.status === "SENT") {
    data.sentAt = new Date();
  }

  const release = await db.pressRelease.update({ where: { id }, data });

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: release.clientId,
      action: "press_release_updated",
      description: `Updated press release: ${release.title}${parsed.data.status ? ` → ${parsed.data.status}` : ""}`,
    },
  });

  return NextResponse.json({ data: release });
}
