import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

const createCampaignSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
  monthlyTarget: z.number().int().min(1).max(30).default(6),
});

export async function GET(req: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;

    const campaigns = await db.campaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { deliverables: true, tasks: true } },
      },
    });

    return NextResponse.json({ data: campaigns });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { clientId, name, description, startDate, endDate, objectives, ownerId, monthlyTarget } = parsed.data;

    const campaign = await db.campaign.create({
      data: {
        clientId,
        name,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        objectives: objectives ?? [],
        ownerId,
        monthlyTarget,
      },
    });

    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "campaign_created",
        description: `Created campaign "${name}"`,
      },
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
