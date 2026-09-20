import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { autoAssignRunners, nextWeekRange } from "@/lib/runner-assign";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Miami day keys, "yyyy-MM-dd". Default: next Monday..Sunday. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** false also re-decides activities that already have a runner. */
  onlyUnassigned: z.boolean().optional(),
  /** Specific activities to (re)decide, e.g. one card's "Assign" action. */
  reassignIds: z.array(z.string()).max(200).optional(),
});

// POST — build the schedule for a date range from the runners' availability
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageRunners(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const fallback = nextWeekRange();
  const from = parsed.data.from ?? fallback.from;
  const to = parsed.data.to ?? fallback.to;
  if (to < from) {
    return NextResponse.json({ error: "End date is before the start date" }, { status: 400 });
  }

  try {
    const report = await autoAssignRunners({
      from,
      to,
      onlyUnassigned: parsed.data.onlyUnassigned ?? true,
      reassignIds: parsed.data.reassignIds,
      actorId: user.id,
    });
    return NextResponse.json({ data: report });
  } catch (err) {
    console.error("POST /api/runner-assignments/auto-assign failed:", err);
    return NextResponse.json({ error: "Could not build the schedule" }, { status: 500 });
  }
}
