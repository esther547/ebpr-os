import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";

const updateStatusSchema = z.object({
  status: z.enum([
    "IDEA",
    "OUTREACH",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
  outcome: z.string().optional(),
});

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    if (!canManageDeliverables(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.deliverable.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true, status: true, title: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deliverable = await db.deliverable.update({
      where: { id: params.id },
      data: {
        status: parsed.data.status,
        outcome: parsed.data.outcome,
        completedAt:
          parsed.data.status === "COMPLETED" ? new Date() : undefined,
      },
    });

    await db.activityLog.create({
      data: {
        clientId: existing.clientId,
        deliverableId: deliverable.id,
        userId: user.id,
        action: "status_changed",
        description: `"${existing.title}" moved to ${parsed.data.status.replace(/_/g, " ").toLowerCase()}`,
        metadata: {
          from: existing.status,
          to: parsed.data.status,
        },
      },
    });

    return NextResponse.json({ data: deliverable });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
