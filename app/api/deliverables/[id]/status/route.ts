import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { slackDeliverableCompleted } from "@/lib/slack";

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

    // Slack notification for completed deliverables
    if (parsed.data.status === "COMPLETED" && existing.status !== "COMPLETED") {
      const clientData = await db.client.findUnique({ where: { id: existing.clientId }, select: { name: true } });
      if (clientData) {
        slackDeliverableCompleted(clientData.name, existing.title, parsed.data.outcome);
      }
    }

    // Notify client portal users when a deliverable is completed
    if (parsed.data.status === "COMPLETED" && existing.status !== "COMPLETED") {
      const clientUsers = await db.clientUser.findMany({
        where: { clientId: existing.clientId, isActive: true },
        select: { id: true },
      });
      // Also notify all internal team about completion
      const teamUsers = await db.user.findMany({
        where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
        select: { id: true },
      });
      for (const cu of teamUsers) {
        await db.notification.create({
          data: {
            userId: cu.id,
            title: "Deliverable Completed",
            message: `"${existing.title}" has been marked as completed`,
            type: "deliverable_completed",
            link: `/clients/${existing.clientId}/deliverables/${existing.id}`,
          },
        });
      }
    }

    // Notify when deliverable goes from IDEA/OUTREACH → CONFIRMED (goes live)
    if (parsed.data.status === "CONFIRMED" && (existing.status === "IDEA" || existing.status === "OUTREACH")) {
      const teamUsers = await db.user.findMany({
        where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
        select: { id: true },
      });
      for (const u of teamUsers) {
        await db.notification.create({
          data: {
            userId: u.id,
            title: "Deliverable Confirmed",
            message: `"${existing.title}" has been confirmed — assign a runner if needed`,
            type: "deliverable_confirmed",
            link: `/clients/${existing.clientId}/deliverables/${existing.id}`,
          },
        });
      }
    }

    return NextResponse.json({ data: deliverable });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
