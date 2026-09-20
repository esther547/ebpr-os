import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { DeliverablesPageClient } from "@/components/deliverables/deliverables-page-client";
import { currentMonthYear, monthLabel } from "@/lib/utils";

type Props = { params: Promise<{ clientId: string }> };

export const metadata = { title: "Deliverables" };
export const dynamic = "force-dynamic";

export default async function DeliverablesPage({ params }: Props) {
  await requireUser();
  const { clientId } = await params;

  const { month, year } = currentMonthYear();

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, monthlyTarget: true, status: true },
  });
  if (!client) notFound();

  const deliverables = await db.deliverable.findMany({
    where: { clientId, month, year },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      campaign: { select: { id: true, name: true } },
      strategyItem: { select: { id: true, title: true } },
      _count: { select: { tasks: true, comments: true, files: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Confirmed-or-later deliverables that still have no runner assignment (yellow prompt on the board)
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
      <PageHeader
        title="Deliverables"
        subtitle={`${client.name} · ${monthLabel(month, year)} · Target: ${client.monthlyTarget}`}
      />
      <DeliverablesPageClient
        deliverables={JSON.parse(JSON.stringify(deliverables))}
        clientId={client.id}
        target={client.monthlyTarget}
        teamMembers={teamMembers}
        runnerNeededIds={runnerNeededIds}
        clientStatus={client.status}
      />
    </>
  );
}
