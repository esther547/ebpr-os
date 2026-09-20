import { NextRequest, NextResponse } from "next/server";
import { Prisma, PressReleaseStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canManagePressReleases } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";
import { journalistWhere } from "@/app/api/journalists/_shared";

const STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "SENT", "CANCELLED"] as const;

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  status: z.enum(STATUSES).optional(),
  // "YYYY-MM-DD" (calendar day) or full ISO; null clears
  scheduledDate: z.string().trim().min(1).nullable().optional(),
  tags: z
    .array(z.string().trim())
    .optional()
    .transform((arr) => (arr === undefined ? undefined : Array.from(new Set(arr.filter(Boolean))))),
});

// Workflow: draft -> pending approval -> approved -> scheduled (weekday) -> sent
const ALLOWED_TRANSITIONS: Record<PressReleaseStatus, PressReleaseStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["SCHEDULED", "DRAFT", "CANCELLED"],
  SCHEDULED: ["SENT", "APPROVED", "CANCELLED"],
  SENT: [],
  CANCELLED: ["DRAFT"],
};

const STATUS_LABELS: Record<PressReleaseStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

/**
 * Parse a scheduled date. A bare "YYYY-MM-DD" is treated as a calendar day (noon local time
 * so it never slips to the previous/next day in UTC); anything else must be a valid ISO string.
 */
function parseScheduledDate(input: string): { date: Date } | { error: string } {
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  let date: Date;
  if (dayOnly) {
    const [, y, m, d] = dayOnly;
    date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== Number(y) ||
      date.getMonth() !== Number(m) - 1 ||
      date.getDate() !== Number(d)
    ) {
      return { error: "Schedule date is not a real calendar date" };
    }
  } else {
    date = new Date(input);
    if (Number.isNaN(date.getTime())) return { error: "Schedule date must be YYYY-MM-DD" };
  }

  const day = date.getDay();
  if (day === 0 || day === 6) {
    return { error: "Press releases go out on weekdays only — pick a Monday to Friday date" };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (date < startOfToday) {
    return { error: "Schedule date can't be in the past" };
  }

  return { date };
}

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const release = await db.pressRelease.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: release });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: first, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await db.pressRelease.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Press release not found" }, { status: 404 });

  if (existing.status === "SENT") {
    return NextResponse.json({ error: "A sent press release can no longer be changed" }, { status: 400 });
  }

  const data: Prisma.PressReleaseUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.content !== undefined) data.content = parsed.data.content;
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;

  // Scheduled date (validated: real date, weekday, not in the past)
  let scheduledDate: Date | null | undefined = undefined;
  if (parsed.data.scheduledDate === null) {
    scheduledDate = null;
  } else if (parsed.data.scheduledDate !== undefined) {
    const result = parseScheduledDate(parsed.data.scheduledDate);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    scheduledDate = result.date;
  }
  if (scheduledDate !== undefined) data.scheduledDate = scheduledDate;

  // Status transitions
  const nextStatus = parsed.data.status;
  if (nextStatus && nextStatus !== existing.status) {
    if (!ALLOWED_TRANSITIONS[existing.status].includes(nextStatus)) {
      return NextResponse.json(
        { error: `Can't move from ${STATUS_LABELS[existing.status]} to ${STATUS_LABELS[nextStatus]}` },
        { status: 400 }
      );
    }
    data.status = nextStatus;

    if (nextStatus === "APPROVED" && existing.status === "PENDING_APPROVAL") {
      data.approvedAt = new Date();
      data.approvedBy = user.name;
    }

    if (nextStatus === "SCHEDULED") {
      const effective = scheduledDate === undefined ? existing.scheduledDate : scheduledDate;
      if (!effective) {
        return NextResponse.json({ error: "Pick a weekday date to schedule this release" }, { status: 400 });
      }
      // Re-validate a previously stored date (it may have gone stale)
      if (scheduledDate === undefined) {
        const check = parseScheduledDate(effective.toISOString());
        if ("error" in check) return NextResponse.json({ error: check.error }, { status: 400 });
      }
    }

    if (nextStatus === "SENT") {
      data.sentAt = new Date();
      // Recipients = active journalists whose beat or tags match the release tags (all journalists if untagged)
      const tags = parsed.data.tags ?? existing.tags;
      data.recipientCount = await db.journalist.count({ where: journalistWhere({ tags }) });
    }

    if (nextStatus === "DRAFT") {
      // Back to the drawing board: approval and schedule no longer apply
      data.approvedAt = null;
      data.approvedBy = null;
      data.scheduledDate = null;
    }
  }

  const release = await db.pressRelease.update({ where: { id }, data });

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: release.clientId,
      action: "press_release_updated",
      description: `Updated press release: ${release.title}${
        nextStatus && nextStatus !== existing.status ? ` → ${STATUS_LABELS[nextStatus]}` : ""
      }`,
    },
  });

  return NextResponse.json({ data: release });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePressReleases(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const existing = await db.pressRelease.findUnique({ where: { id }, select: { id: true, status: true, title: true, clientId: true } });
  if (!existing) return NextResponse.json({ error: "Press release not found" }, { status: 404 });
  if (existing.status === "SENT") {
    return NextResponse.json({ error: "Sent press releases are kept for the record and can't be deleted" }, { status: 400 });
  }

  await db.pressRelease.delete({ where: { id } });
  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: existing.clientId,
      action: "press_release_deleted",
      description: `Deleted press release: ${existing.title}`,
    },
  });

  return NextResponse.json({ message: "Press release deleted" });
}
