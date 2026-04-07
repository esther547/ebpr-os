"use client";

import { cn } from "@/lib/utils";
import type { Task, User } from "@prisma/client";

type TaskWithAssignee = Task & {
  assignee: Pick<User, "id" | "name"> | null;
};

const STATUS_STYLES: Record<string, string> = {
  TODO: "bg-surface-2 text-ink-muted",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  BLOCKED: "bg-red-50 text-red-600",
  DONE: "bg-green-50 text-green-700",
  CANCELLED: "bg-surface-2 text-ink-secondary",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "Pending",
  IN_PROGRESS: "Working on it",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "text-ink-muted",
  MEDIUM: "text-ink-secondary",
  HIGH: "text-amber-600",
  URGENT: "text-red-600 font-bold",
};

export function StrategyWorkflowTable({
  tasks,
}: {
  tasks: TaskWithAssignee[];
}) {
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          Workflow
        </span>
        <span className="text-xs text-ink-muted">{tasks.length} tasks</span>
        {doneCount > 0 && (
          <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-2xs font-semibold text-green-700">
            {doneCount} done
          </span>
        )}
        {inProgressCount > 0 && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">
            {inProgressCount} in progress
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_140px_110px] border-b border-border bg-surface-1 px-5 py-2">
          <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
            Item
          </span>
          <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
            Deadline
          </span>
          <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
            Assignee
          </span>
          <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
            Status
          </span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <WorkflowRow key={task.id} task={task} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowRow({ task }: { task: TaskWithAssignee }) {
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;

  return (
    <div className="grid grid-cols-[1fr_120px_140px_110px] items-start px-5 py-3 hover:bg-surface-1 transition-colors">
      {/* Item */}
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-1.5">
          {task.priority === "HIGH" || task.priority === "URGENT" ? (
            <span className={cn("text-2xs flex-shrink-0", PRIORITY_STYLES[task.priority])}>
              ●
            </span>
          ) : null}
          <p className="text-sm font-medium text-ink-primary">{task.title}</p>
        </div>
        {task.description && (
          <p className="text-2xs text-ink-muted truncate mt-0.5">{task.description}</p>
        )}
      </div>

      {/* Deadline */}
      <div className="pt-0.5">
        {task.dueDate ? (
          <span
            className={cn(
              "text-xs",
              task.status !== "DONE" &&
                new Date(task.dueDate) < new Date()
                ? "text-red-600 font-medium"
                : "text-ink-secondary"
            )}
          >
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>

      {/* Assignee */}
      <div className="pt-0.5">
        {task.assignee ? (
          <span className="text-xs text-ink-secondary">{task.assignee.name}</span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>

      {/* Status */}
      <div className="pt-0.5">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-2xs font-semibold",
            STATUS_STYLES[task.status] ?? "bg-surface-2 text-ink-muted"
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
