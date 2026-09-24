import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { recordStatusTransition } from "../../_lib/status-transition";
import { resolveCloser, type Closer } from "../../_lib/closer";

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
  /** Strategist who closed the goal; only used when status is COMPLETED. */
  closedById: z.string().min(1).nullable().optional(),
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
      select: {
        id: true,
        clientId: true,
        status: true,
        title: true,
        assigneeId: true,
        completedAt: true,
        closedById: true,
        closedAt: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const to = parsed.data.status;
    const alreadyCompleted = existing.status === "COMPLETED";

    // Who closed the goal. Entering COMPLETED always records a closer; on a goal that is
    // already COMPLETED an explicit closedById (re)assigns it, and a missing one is filled in.
    let closer: Closer | null = null;
    const setCloser =
      to === "COMPLETED" && (!alreadyCompleted || !!parsed.data.closedById || !existing.closedById);
    if (setCloser) {
      const resolved = await resolveCloser({
        requestedId: parsed.data.closedById,
        currentUser: user,
        assigneeId: existing.assigneeId,
      });
      if (resolved.error !== undefined) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      closer = resolved.closer;
    }

    const deliverable = await db.deliverable.update({
      where: { id: params.id },
      data: {
        status: to,
        ...(parsed.data.outcome !== undefined && { outcome: parsed.data.outcome }),
        completedAt:
          to === "COMPLETED"
            ? alreadyCompleted
              ? existing.completedAt ?? new Date()
              : new Date()
            : to === existing.status
              ? undefined
              : null,
        // Leaving COMPLETED clears the closer.
        ...(to === "COMPLETED"
          ? setCloser && { closedById: closer?.id ?? null, closedAt: existing.closedAt ?? new Date() }
          : { closedById: null }),
      },
      include: { closedBy: { select: { id: true, name: true } } },
    });

    await recordStatusTransition({
      deliverable: existing,
      from: existing.status,
      to,
      userId: user.id,
      outcome: parsed.data.outcome,
      closedBy: closer,
    });

    // Correcting the closer on a goal that was already closed.
    if (alreadyCompleted && to === "COMPLETED" && closer && closer.id !== existing.closedById) {
      await db.activityLog.create({
        data: {
          clientId: existing.clientId,
          deliverableId: existing.id,
          userId: user.id,
          action: "deliverable_updated",
          description: `"${existing.title}" — cerrada por ${closer.name}`,
          metadata: { closedById: closer.id, previousClosedById: existing.closedById },
        },
      });
    }

    return NextResponse.json({ data: deliverable });
  } catch (err) {
    console.error("POST /api/deliverables/[id]/status failed:", err);
    return NextResponse.json({ error: "Could not update status" }, { status: 500 });
  }
}
