import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { currentMonthYear } from "@/lib/utils";

const createDeliverableSchema = z.object({
  clientId: z.string().min(1),
  campaignId: z.string().optional(),
  title: z.string().min(1).max(200),
  type: z.enum([
    "PRESS_PLACEMENT",
    "INTERVIEW",
    "INFLUENCER_COLLAB",
    "EVENT_APPEARANCE",
    "BRAND_OPPORTUNITY",
    "INTRODUCTION",
    "SOCIAL_MEDIA",
    "PRESS_RELEASE",
    "OTHER",
  ]),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).optional(),
  notes: z.string().optional(),
  isClientVisible: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageDeliverables(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createDeliverableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { month: bodyMonth, year: bodyYear, ...rest } = parsed.data;
    const { month, year } = currentMonthYear();

    const deliverable = await db.deliverable.create({
      data: {
        ...rest,
        month: bodyMonth ?? month,
        year: bodyYear ?? year,
        dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Log
    await db.activityLog.create({
      data: {
        clientId: parsed.data.clientId,
        deliverableId: deliverable.id,
        userId: user.id,
        action: "deliverable_created",
        description: `Created deliverable "${deliverable.title}"`,
      },
    });

    return NextResponse.json({ data: deliverable }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
