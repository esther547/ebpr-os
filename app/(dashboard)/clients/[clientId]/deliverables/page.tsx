import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor, currentAndUpcoming, windowShortLabel } from "@/lib/client-availability";
import { addDaysKey, dayKeyInTz } from "@/components/runners/miami-time";
import { DeliverablesPageClient } from "@/components/deliverables/deliverables-page-client";
import { currentCycle, cycleLabel } from "@/lib/cycles";
import { StrategyContextCard } from "@/components/strategy/strategy-context-card";
import { ClientWeekPriorities } from "@/components/priorities/client-week-priorities";

type Props = { params: Promise<{ clientId: string }> };

export const metadata = { title: "Deliverables" };
export const dynamic = "force-dynamic";

export default async function DeliverablesPage({ params }: Props) {
  const user = await requireUser();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, monthlyTarget: true, status: true, industry: true, cycleDay: true, goalsOwed: true, focusNote: true, agendaDocUrl: true, strategyDocUrl: true },
  });
  if (!client) notFound();
  const availabilityNow = await availabilityNowFor(client.id);
  // OFF / TRAVEL windows in the next 60 days (banner above the board).
  const horizonKey = addDaysKey(dayKeyInTz(new Date()), 60);
  const upcomingWindows = (await currentAndUpcoming(client.id)).filter((w) => w.startKey <= horizonKey);

  const cycle = currentCycle(client.cycleDay);
  const { month, year } = cycle;

  const deliverables = await db.deliverable.findMany({
    where: { clientId, month, year },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      closedBy: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
      strategyItem: { select: { id: true, title: true } },
      _count: { select: { tasks: true, comments: true, files: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Confirmed-or-later deliverables that still have no runner assignment (warning prompt on the board)
  const assignments = await db.runnerAssignment.findMany({
    where: { deliverableId: { in: deliverables.map((d) => d.id) }, status: { not: "CANCELLED" } },
    select: { deliverableId: true },
  });
  const withRunner = new Set(assignments.map((a) => a.deliverableId));
  const runnerNeededIds = deliverables
    .filter((d) => ["CONFIRMED", "IN_PROGRESS"].includes(d.status) && !withRunner.has(d.id))
    .map((d) => d.id);

  const teamMembers = await db.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "STRATEGIST"] },
      isActive: true,
    },
    select: { id: true, name: true },
  });

  return (
    <>
      <ClientHeader availabilityNow={availabilityNow} client={client} counts={{ deliverables: deliverables.length }} />
      <div className="mb-6">
        <StrategyContextCard clientId={client.id} strategyDocUrl={client.strategyDocUrl} />
      </div>
      <div className="mb-6">
        <ClientWeekPriorities clientId={client.id} />
      </div>
      {upcomingWindows.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-accent2/20 bg-accent2-soft px-4 py-2.5 text-sm">
          <span className="font-semibold text-accent2-ink">Próximos:</span>
          <span className="min-w-0 flex-1 text-ink-secondary">
            {upcomingWindows.map((w, i) => (
              <span key={w.id}>
                {i > 0 && <span className="text-ink-muted"> · </span>}
                <span className={w.kind === "OFF" ? "font-medium text-red-700" : "font-medium text-blue-700"}>
                  {windowShortLabel(w)}
                </span>
              </span>
            ))}
          </span>
          <a href={`/clients/${client.id}#disponibilidad`} className="text-xs font-medium text-ink-primary underline-offset-2 hover:underline">
            Disponibilidad y viajes
          </a>
        </div>
      )}
      <DeliverablesPageClient
        deliverables={JSON.parse(JSON.stringify(deliverables))}
        clientId={client.id}
        target={client.monthlyTarget}
        teamMembers={teamMembers}
        currentUserId={user.id}
        runnerNeededIds={runnerNeededIds}
        clientStatus={client.status}
        monthLabel={cycleLabel(cycle, client.cycleDay)}
      />
    </>
  );
}
