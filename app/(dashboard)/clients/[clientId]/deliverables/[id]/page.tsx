import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliverableDetailClient } from "@/components/deliverables/deliverable-detail-client";

export const metadata = { title: "Deliverable" };
export const dynamic = "force-dynamic";

export default async function DeliverableDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; id: string }>;
}) {
  await requireUser();
  const { clientId, id } = await params;

  const deliverable = await db.deliverable.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, avatar: true } },
      campaign: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!deliverable || deliverable.clientId !== clientId) notFound();

  // Get linked runner assignment for this deliverable
  const runnerAssignment = await db.runnerAssignment.findFirst({
    where: { deliverableId: id },
    include: { runner: { select: { id: true, name: true } } },
  });

  const teamMembers = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true },
    select: { id: true, name: true },
  });

  const runners = await db.user.findMany({
    where: { role: "RUNNER", isActive: true },
    select: { id: true, name: true },
  });

  const deliverableWithRunner = {
    ...deliverable,
    runnerAssignment,
  };

  return (
    <DeliverableDetailClient
      deliverable={JSON.parse(JSON.stringify(deliverableWithRunner))}
      teamMembers={teamMembers}
      runners={runners}
    />
  );
}
