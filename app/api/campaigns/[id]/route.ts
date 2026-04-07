import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["PREPARATION", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  objectives: z.array(z.string()).optional(),
  ownerId: z.string().nullable().optional(),
  monthlyTarget: z.number().int().min(1).max(30).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const campaign = await db.campaign.findUniqueOrThrow({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        deliverables: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { deliverables: true, tasks: true } },
      },
    });

    return NextResponse.json({ data: campaign });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.status !== undefined) data.status = d.status;
    if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.endDate !== undefined) data.endDate = d.endDate ? new Date(d.endDate) : null;
    if (d.objectives !== undefined) data.objectives = d.objectives;
    if (d.ownerId !== undefined) data.ownerId = d.ownerId;
    if (d.monthlyTarget !== undefined) data.monthlyTarget = d.monthlyTarget;

    const campaign = await db.campaign.update({
      where: { id },
      data,
    });

    await db.activityLog.create({
      data: {
        clientId: campaign.clientId,
        userId: user.id,
        action: "campaign_updated",
        description: `Updated campaign "${campaign.name}"`,
      },
    });

    return NextResponse.json({ data: campaign });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
