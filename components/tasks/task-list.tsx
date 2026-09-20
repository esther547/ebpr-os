"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";
import { CreateTaskModal } from "./create-task-modal";
import { Circle, CheckCircle2, AlertCircle, Clock, Ban, Plus, ListChecks } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | Date | null;
  assignee: { id: string; name: string; avatar: string | null } | null;
  deliverable: { id: string; title: string; type: string } | null;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  TODO: <Circle className="h-4 w-4 text-ink-muted" />,
  IN_PROGRESS: <Clock className="h-4 w-4 text-blue-500" />,
  BLOCKED: <AlertCircle className="h-4 w-4 text-red-500" />,
  DONE: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  CANCELLED: <Ban className="h-4 w-4 text-ink-muted" />,
};

const PRIORITY_TONES: Record<string, BadgeTone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

interface Props {
  tasks: Task[];
  clientId: string;
  teamMembers: { id: string; name: string }[];
}

export function TaskList({ tasks, clientId, teamMembers }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const openTasks = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const closedTasks = tasks.filter((t) => t.status === "DONE" || t.status === "CANCELLED");

  async function toggleDone(taskId: string, currentStatus: string) {
    setUpdating(taskId);
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setUpdating(null);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tasks"
        description={`${openTasks.length} open · ${closedTasks.length} closed`}
        actions={
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No tasks yet"
          description="Create the first task for this client."
          action={
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
              New Task
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {openTasks.length > 0 && (
            <section>
              <SectionHeader title={`Open (${openTasks.length})`} />
              <TaskTable tasks={openTasks} onToggle={toggleDone} updating={updating} />
            </section>
          )}

          {closedTasks.length > 0 && (
            <section>
              <SectionHeader title={`Completed (${closedTasks.length})`} />
              <TaskTable tasks={closedTasks} onToggle={toggleDone} updating={updating} />
            </section>
          )}
        </div>
      )}

      <CreateTaskModal
        open={showCreate}
        onOpenChange={setShowCreate}
        clientId={clientId}
        teamMembers={teamMembers}
      />
    </div>
  );
}

function TaskTable({
  tasks,
  onToggle,
  updating,
}: {
  tasks: Task[];
  onToggle: (id: string, status: string) => void;
  updating: string | null;
}) {
  return (
    <Card padding="none">
      <ul className="divide-y divide-border">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-1 sm:items-center sm:gap-4 sm:px-5",
              task.status === "DONE" && "opacity-60"
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(task.id, task.status)}
              disabled={updating === task.id}
              className="mt-0.5 shrink-0 rounded disabled:opacity-50 sm:mt-0"
              aria-label={task.status === "DONE" ? `Reopen ${task.title}` : `Complete ${task.title}`}
            >
              {STATUS_ICON[task.status]}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-sm",
                    task.status === "DONE" ? "text-ink-muted line-through" : "font-medium text-ink-primary"
                  )}
                >
                  {task.title}
                </span>
                <Badge size="xs" tone={PRIORITY_TONES[task.priority] ?? "neutral"} className="capitalize">
                  {task.priority.toLowerCase()}
                </Badge>
              </div>
              {task.deliverable && (
                <p className="mt-0.5 truncate text-2xs text-ink-muted">Linked: {task.deliverable.title}</p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs sm:flex-row sm:items-center sm:gap-4">
              {task.assignee && <span className="text-ink-secondary">{task.assignee.name.split(" ")[0]}</span>}
              {task.dueDate && <span className="text-ink-muted">{formatDate(task.dueDate)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
