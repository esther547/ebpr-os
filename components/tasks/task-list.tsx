"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { CreateTaskModal } from "./create-task-modal";
import { Circle, CheckCircle2, AlertCircle, Clock, Ban } from "lucide-react";

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
  DONE: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  CANCELLED: <Ban className="h-4 w-4 text-ink-muted" />,
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "text-ink-muted",
  MEDIUM: "text-blue-600",
  HIGH: "text-amber-600 font-medium",
  URGENT: "text-red-600 font-semibold",
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
    <>
      <div className="mb-6">
        <Button onClick={() => setShowCreate(true)}>+ New Task</Button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-ink-primary">No tasks yet</p>
          <p className="mt-1 text-sm text-ink-muted">Create the first task for this client.</p>
        </div>
      ) : (
        <>
          {openTasks.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Open ({openTasks.length})
              </h2>
              <TaskTable tasks={openTasks} onToggle={toggleDone} updating={updating} />
            </section>
          )}

          {closedTasks.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Completed ({closedTasks.length})
              </h2>
              <TaskTable tasks={closedTasks} onToggle={toggleDone} updating={updating} />
            </section>
          )}
        </>
      )}

      <CreateTaskModal
        open={showCreate}
        onOpenChange={setShowCreate}
        clientId={clientId}
        teamMembers={teamMembers}
      />
    </>
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
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-4 px-5 py-3.5 hover:bg-surface-1 transition-colors",
              task.status === "DONE" && "opacity-60"
            )}
          >
            <button
              onClick={() => onToggle(task.id, task.status)}
              disabled={updating === task.id}
              className="shrink-0"
            >
              {STATUS_ICON[task.status]}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm", task.status === "DONE" ? "line-through text-ink-muted" : "text-ink-primary font-medium")}>
                  {task.title}
                </span>
                <span className={cn("text-2xs", PRIORITY_STYLES[task.priority])}>
                  {task.priority}
                </span>
              </div>
              {task.deliverable && (
                <p className="text-2xs text-ink-muted mt-0.5">
                  Linked: {task.deliverable.title}
                </p>
              )}
            </div>

            {task.assignee && (
              <span className="text-xs text-ink-secondary shrink-0">
                {task.assignee.name.split(" ")[0]}
              </span>
            )}

            {task.dueDate && (
              <span className="text-xs text-ink-muted shrink-0">
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
