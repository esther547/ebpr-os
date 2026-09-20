import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { recordStatusTransition } from "../../_lib/status-transition";

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
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageDeliverables(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const existing = await db.deliverable.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true, status: true, title: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const to = parsed.data.status;
    const deliverable = await db.deliverable.update({
      where: { id: params.id },
      data: {
        status: to,
        ...(parsed.data.outcome !== undefined && { outcome: parsed.data.outcome }),
        completedAt:
          to === "COMPLETED" ? new Date() : to === existing.status ? undefined : null,
      },
    });

    await recordStatusTransition({
      deliverable: existing,
      from: existing.status,
      to,
      userId: user.id,
      outcome: parsed.data.outcome,
    });

    return NextResponse.json({ data: deliverable });
  } catch (err) {
    console.error("POST /api/deliverables/[id]/status failed:", err);
    return NextResponse.json({ error: "Could not update status" }, { status: 500 });
  }
}
