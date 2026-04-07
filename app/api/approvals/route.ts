import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canRequestApprovals } from "@/lib/permissions";

const createApprovalSchema = z.object({
  clientId: z.string().min(1),
  deliverableId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum([
    "STRATEGY_IDEA",
    "PRESS_RELEASE",
    "INTERVIEW_QUESTIONS",
    "PROPOSAL",
    "OTHER",
  ]),
  content: z.string().optional(),
  fileUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canRequestApprovals(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const approval = await db.approval.create({
      data: {
        ...parsed.data,
        requestedById: user.id,
        status: "PENDING",
      },
    });

    await db.activityLog.create({
      data: {
        clientId: parsed.data.clientId,
        userId: user.id,
        action: "approval_requested",
        description: `Requested approval for "${approval.title}"`,
      },
    });

    return NextResponse.json({ data: approval }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
