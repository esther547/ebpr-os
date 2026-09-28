import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageRunners } from "@/lib/permissions";
import { autoAssignRunners } from "@/lib/runner-assign";
import { notifyRunnerAssigned, notifyRunnersOpenActivity, notifyTeamRunnerReleased } from "@/lib/runner-notify";
import { dayKeyInTz } from "@/components/runners/miami-time";

const bodySchema = z.object({ reason: z.string().trim().max(1000).optional().nullable() });

/**
 * POST — the assigned runner steps down from a pauta ("no puedo asistir").
 * The pauta stays on the agenda without a runner, the engine tries another runner right away,
 * and admins + strategists are told (with the reason and the outcome). Admins/strategists may
 * also release a runner from here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const parsed = bodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Motivo inválido" }, { status: 400 });
  const reason = parsed.data.reason?.trim() || null;

  const a = await db.runnerAssignment.findUnique({
    where: { id: params.id },
    select: { id: true, runnerId: true, status: true, eventDate: true, eventName: true, clientId: true, internalNotes: true, runner: { select: { id: true, name: true } } },
  });
  if (!a) return NextResponse.json({ error: "Pauta no encontrada" }, { status: 404 });
  const isOwnRunner = user.role === "RUNNER" && a.runnerId === user.id;
  if (!isOwnRunner && !canManageRunners(user)) return NextResponse.json({ error: "Pauta no encontrada" }, { status: 404 });
  if (!a.runnerId || !a.runner) return NextResponse.json({ error: "Esta pauta no tiene runner asignado" }, { status: 409 });
  if (a.status === "COMPLETED" || a.status === "CANCELLED") return NextResponse.json({ error: "Esta pauta ya está cerrada" }, { status: 409 });

  const released = a.runner;
  const { clientId, eventName } = a;
  const stamp = dayKeyInTz(new Date());
  const line = `${released.name} no puede asistir (${stamp})${reason ? `: ${reason}` : ""}`;
  await db.runnerAssignment.update({
    where: { id: a.id },
    data: {
      runnerId: null,
      autoAssigned: false,
      assignedAt: null,
      internalNotes: a.internalNotes ? `${a.internalNotes}\n${line}` : line,
    },
  });
  await db.activityLog.create({
    data: {
      clientId: clientId ?? undefined,
      userId: user.id,
      action: "runner_released",
      description: `${released.name} stepped down from "${eventName}"${reason ? ` (${reason})` : ""}`,
      metadata: { assignmentId: a.id, runnerId: released.id, reason },
    },
  }).catch(() => undefined);

  // Someone else available? Never the runner who just stepped down.
  let replacement: { name: string } | null = null;
  try {
    const report = await autoAssignRunners({ reassignIds: [a.id], excludeRunnerIds: [released.id], actorId: user.id });
    const pick = report.assigned.find((r) => r.id === a.id);
    if (pick) {
      const fresh = await db.runnerAssignment.findUnique({ where: { id: a.id }, select: { runner: { select: { name: true } } } });
      replacement = fresh?.runner ?? null;
      await notifyRunnerAssigned(a.id);
    }
  } catch (err) {
    console.error("release: auto-assign failed", err);
  }
  await notifyTeamRunnerReleased(a.id, released, reason, replacement);
  if (!replacement) await notifyRunnersOpenActivity(a.id).catch(() => undefined);

  return NextResponse.json({ data: { released: released.name, replacement: replacement?.name ?? null } });
}
