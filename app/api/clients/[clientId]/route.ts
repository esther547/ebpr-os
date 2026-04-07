import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients, canViewClients } from "@/lib/permissions";

const updateClientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  monthlyTarget: z.number().int().min(1).max(30).optional(),
  status: z.enum(["PROSPECT", "ACTIVE", "PAUSED", "CHURNED"]).optional(),
  description: z.string().optional(),
});

type Params = { params: { clientId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    if (!canViewClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await db.client.findUnique({
      where: { id: params.clientId },
      include: {
        contacts: true,
        contracts: { orderBy: { createdAt: "desc" } },
        onboarding: { include: { checklistItems: true } },
        campaigns: { orderBy: { createdAt: "desc" } },
        _count: {
          select: { deliverables: true, strategyItems: true, files: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: client });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const client = await db.client.update({
      where: { id: params.clientId },
      data: parsed.data,
    });

    await db.activityLog.create({
      data: {
        clientId: client.id,
        userId: user.id,
        action: "client_updated",
        description: `Updated client ${client.name}`,
      },
    });

    return NextResponse.json({ data: client });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
