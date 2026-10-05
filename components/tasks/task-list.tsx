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

/** What the team picks. "Bloqueado" stays available for when something is stuck. */
const STATUS_OPTIONS = [
  { value: "TODO", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "Trabajando en eso" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "DONE", label: "Listo" },
];
const STATUS_SELECT_CLASS: Record<string, string> = {
  TODO: "border-border text-ink-secondary",
  IN_PROGRESS: "border-blue-300 bg-blue-50 text-blue-800",
  BLOCKED: "border-red-300 bg-red-50 text-red-800",
  DONE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-border text-ink-muted",
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

  // Real states, chosen explicitly (Esther, Oct 5 2026): a task is only "Listo" when someone says so,
  // and any state can be changed back.
  async function setStatus(taskId: string, newStatus: string) {
    setUpdating(taskId);
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
              <TaskTable tasks={openTasks} onStatus={setStatus} updating={updating} />
            </section>
          )}

          {closedTasks.length > 0 && (
            <section>
              <SectionHeader title={`Completed (${closedTasks.length})`} />
              <TaskTable tasks={closedTasks} onStatus={setStatus} updating={updating} />
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
  onStatus,
  updating,
}: {
  tasks: Task[];
  onStatus: (id: string, status: string) => void;
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
            <span className="mt-0.5 shrink-0 sm:mt-0" aria-hidden>{STATUS_ICON[task.status]}</span>

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

            <div className="flex shrink-0 flex-col items-end gap-1 text-xs sm:flex-row sm:items-center sm:gap-4">
              {task.assignee && <span className="text-ink-secondary">{task.assignee.name.split(" ")[0]}</span>}
              {task.dueDate && <span className="text-ink-muted">{formatDate(task.dueDate)}</span>}
              <select
                value={task.status}
                disabled={updating === task.id}
                onChange={(e) => onStatus(task.id, e.target.value)}
                aria-label={`Estado de ${task.title}`}
                className={cn(
                  "h-7 rounded-md border bg-white px-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ink-primary/20 disabled:opacity-50",
                  STATUS_SELECT_CLASS[task.status] ?? "border-border text-ink-secondary"
                )}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                {task.status === "CANCELLED" && <option value="CANCELLED">Cancelado</option>}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
