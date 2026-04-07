import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { TaskList } from "@/components/tasks/task-list";

type Props = { params: Promise<{ clientId: string }> };

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage({ params }: Props) {
  await requireUser();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) notFound();

  const tasks = await db.task.findMany({
    where: { clientId },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
      deliverable: { select: { id: true, title: true, type: true } },
    },
  });

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
        title="Tasks"
        subtitle={`${client.name} · ${tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length} open`}
      />
      <TaskList tasks={tasks} clientId={clientId} teamMembers={teamMembers} />
    </>
  );
}
