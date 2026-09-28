import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyTeamRunnerClaimed } from "@/lib/runner-notify";
import { dayKeyInTz, tzMidnight } from "@/components/runners/miami-time";

/**
 * POST — a runner takes an open pauta ("I can take this") from the portal list of future pautas
 * without a runner. Only pautas that are still open, active and today-or-later. The team is told.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (user.role !== "RUNNER") return NextResponse.json({ error: "Solo los runners pueden tomar pautas desde aquí" }, { status: 403 });

  const a = await db.runnerAssignment.findUnique({ where: { id: params.id }, select: { id: true, runnerId: true, status: true, eventDate: true, clientId: true, eventName: true, runner: { select: { name: true } } } });
  if (!a) return NextResponse.json({ error: "Pauta no encontrada" }, { status: 404 });
  if (a.status === "COMPLETED" || a.status === "CANCELLED") return NextResponse.json({ error: "Esta pauta ya está cerrada" }, { status: 409 });
  if (a.eventDate < tzMidnight(dayKeyInTz(new Date()))) return NextResponse.json({ error: "Esta pauta ya pasó" }, { status: 409 });
  if (a.runnerId) return NextResponse.json({ error: `Esta pauta ya la tomó ${a.runner?.name ?? "otro runner"}` }, { status: 409 });

  // Atomic: only wins if it is still open.
  const res = await db.runnerAssignment.updateMany({ where: { id: a.id, runnerId: null }, data: { runnerId: user.id, autoAssigned: false, assignedAt: new Date() } });
  if (res.count === 0) return NextResponse.json({ error: "Alguien más la tomó justo ahora" }, { status: 409 });

  await db.activityLog.create({
    data: { clientId: a.clientId ?? undefined, userId: user.id, action: "runner_claimed", description: `${user.name} took "${a.eventName}" from the runner portal`, metadata: { assignmentId: a.id } },
  }).catch(() => undefined);
  await notifyTeamRunnerClaimed(a.id, { name: user.name }).catch(() => undefined);
  return NextResponse.json({ data: { id: a.id, runnerId: user.id } });
}
