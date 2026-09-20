"use client";

import { cn } from "@/lib/utils";
import type { Task, User } from "@prisma/client";
import { TableWrap, Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";

type TaskWithAssignee = Task & {
  assignee: Pick<User, "id" | "name"> | null;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  TODO: "neutral",
  IN_PROGRESS: "warning",
  BLOCKED: "danger",
  DONE: "success",
  CANCELLED: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "Pending",
  IN_PROGRESS: "Working on it",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const PRIORITY_TONES: Record<string, BadgeTone> = {
  HIGH: "warning",
  URGENT: "danger",
};

export function StrategyWorkflowTable({ tasks }: { tasks: TaskWithAssignee[] }) {
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <section>
      <SectionHeader
        title="Workflow"
        actions={
          <div className="flex items-center gap-2">
            <span className="tabular text-xs text-ink-muted">{tasks.length} tasks</span>
            {doneCount > 0 && (
              <Badge size="xs" tone="success">
                {doneCount} done
              </Badge>
            )}
            {inProgressCount > 0 && (
              <Badge size="xs" tone="warning">
                {inProgressCount} in progress
              </Badge>
            )}
          </div>
        }
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Deadline</Th>
              <Th>Assignee</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <TableEmpty colSpan={4}>No workflow tasks yet.</TableEmpty>
            ) : (
              tasks.map((task) => <WorkflowRow key={task.id} task={task} />)
            )}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

function WorkflowRow({ task }: { task: TaskWithAssignee }) {
  const overdue = task.status !== "DONE" && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <tr>
      <Td>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink-primary">{task.title}</p>
          {PRIORITY_TONES[task.priority] && (
            <Badge size="xs" tone={PRIORITY_TONES[task.priority]} className="capitalize">
              {task.priority.toLowerCase()}
            </Badge>
          )}
        </div>
        {task.description && (
          <p className="mt-0.5 max-w-md truncate text-2xs text-ink-muted">{task.description}</p>
        )}
      </Td>

      <Td className="whitespace-nowrap">
        {task.dueDate ? (
          <span className={cn("tabular text-xs", overdue ? "font-medium text-red-600" : "text-ink-secondary")}>
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>

      <Td>
        {task.assignee ? (
          <span className="text-xs text-ink-secondary">{task.assignee.name}</span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>

      <Td>
        <Badge size="xs" tone={STATUS_TONES[task.status] ?? "neutral"} dot>
          {STATUS_LABELS[task.status] ?? task.status}
        </Badge>
      </Td>
    </tr>
  );
}
