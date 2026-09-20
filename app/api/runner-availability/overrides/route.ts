import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { db } from "@/lib/db";
import { dayKeyInTz } from "@/components/runners/miami-time";

export const dynamic = "force-dynamic";

/**
 * Per-date availability overrides (RunnerAvailability). An override wins over
 * the weekly pattern for that date: `isAvailable: false` takes the runner out
 * of the auto-scheduler for the whole day.
 *
 * Dates are exchanged as "yyyy-MM-dd" and stored at 12:00 UTC (the project's
 * date-only convention) so the Miami calendar day is never off by one.
 */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" -> noon UTC. */
function parseDayKey(value: string): Date {
  const m = DAY_KEY.exec(value);
  if (!m) return new Date(NaN);
  const [y, mo, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12));
}

async function resolveTarget(
  user: SessionUser,
  requestedId: string | null | undefined
): Promise<{ userId: string } | { error: string; status: number }> {
  const targetId = requestedId || user.id;
  if (targetId === user.id) return { userId: targetId };
  if (!canManageRunners(user)) return { error: "Forbidden", status: 403 };
  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return { error: "Runner not found", status: 404 };
  return { userId: targetId };
}

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveTarget(user, new URL(req.url).searchParams.get("userId"));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const rows = await db.runnerAvailability.findMany({
    where: { userId: resolved.userId },
    orderBy: { date: "asc" },
    select: { id: true, date: true, isAvailable: true, notes: true },
  });

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      date: dayKeyInTz(r.date),
      isAvailable: r.isAvailable,
      notes: r.notes,
    })),
  });
}

const postSchema = z.object({
  userId: z.string().optional(),
  date: z.string().regex(DAY_KEY, "Use a yyyy-MM-dd date"),
  isAvailable: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const resolved = await resolveTarget(user, parsed.data.userId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const date = parseDayKey(parsed.data.date);
  const row = await db.runnerAvailability.upsert({
    where: { userId_date: { userId: resolved.userId, date } },
    create: {
      userId: resolved.userId,
      date,
      isAvailable: parsed.data.isAvailable,
      notes: parsed.data.notes ?? null,
    },
    update: { isAvailable: parsed.data.isAvailable, notes: parsed.data.notes ?? null },
    select: { id: true, date: true, isAvailable: true, notes: true },
  });

  return NextResponse.json({
    data: {
      id: row.id,
      date: dayKeyInTz(row.date),
      isAvailable: row.isAvailable,
      notes: row.notes,
    },
  });
}

export async function DELETE(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const row = await db.runnerAvailability.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!row) return NextResponse.json({ error: "Override not found" }, { status: 404 });
  if (row.userId !== user.id && !canManageRunners(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.runnerAvailability.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
