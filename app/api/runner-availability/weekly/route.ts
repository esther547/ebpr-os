import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatHHmm, parseHHmm } from "@/components/runners/miami-time";

export const dynamic = "force-dynamic";

/**
 * A runner's recurring weekly availability, in Miami time.
 *
 * SUPER_ADMIN / STRATEGIST may read and write anyone's; a RUNNER may only read
 * and write their own. Everything is stored as minutes from Miami midnight and
 * exchanged as "HH:mm" so the browser never has to do timezone maths.
 */

const windowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  start: z.string(),
  end: z.string(),
});

const putSchema = z.object({
  userId: z.string().optional(),
  windows: z.array(windowSchema).max(50),
});

/** Resolve the target runner and check the caller may touch them. */
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

  const requestedId = new URL(req.url).searchParams.get("userId");
  const resolved = await resolveTarget(user, requestedId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const rows = await db.runnerWeeklyAvailability.findMany({
    where: { userId: resolved.userId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    select: { id: true, dayOfWeek: true, startMinute: true, endMinute: true },
  });

  return NextResponse.json({
    data: {
      userId: resolved.userId,
      windows: rows.map((r) => ({
        id: r.id,
        dayOfWeek: r.dayOfWeek,
        start: formatHHmm(r.startMinute),
        end: formatHHmm(r.endMinute),
      })),
    },
  });
}

// PUT — replace the runner's whole weekly pattern with the given windows
export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const resolved = await resolveTarget(user, parsed.data.userId ?? null);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const rows: { userId: string; dayOfWeek: number; startMinute: number; endMinute: number }[] = [];
  for (const w of parsed.data.windows) {
    const startMinute = parseHHmm(w.start);
    const endMinute = parseHHmm(w.end);
    if (startMinute === null || endMinute === null) {
      return NextResponse.json({ error: `Invalid time "${w.start}"–"${w.end}"` }, { status: 400 });
    }
    if (endMinute <= startMinute) {
      return NextResponse.json(
        { error: "The end of a window must be after its start" },
        { status: 400 }
      );
    }
    rows.push({ userId: resolved.userId, dayOfWeek: w.dayOfWeek, startMinute, endMinute });
  }

  await db.$transaction([
    db.runnerWeeklyAvailability.deleteMany({ where: { userId: resolved.userId } }),
    ...(rows.length ? [db.runnerWeeklyAvailability.createMany({ data: rows })] : []),
  ]);

  return NextResponse.json({
    data: {
      userId: resolved.userId,
      windows: rows
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)
        .map((r) => ({
          dayOfWeek: r.dayOfWeek,
          start: formatHHmm(r.startMinute),
          end: formatHHmm(r.endMinute),
        })),
    },
  });
}
