import Link from "next/link";
import { ArrowUpRight, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { dayKeyInTz, weekStartKey } from "@/components/runners/miami-time";
import { weekOfInstant } from "@/lib/priorities";
import { PriorityToggle } from "./priority-toggle";
import { weekRangeLabel } from "./helpers";

/**
 * Server component: the client's pending lines from this week's priority list,
 * shown as live context on the deliverables page.
 */
export async function ClientWeekPriorities({ clientId }: { clientId: string }) {
  const weekKey = weekStartKey(dayKeyInTz(new Date()));

  const items = await db.weeklyPriority.findMany({
    where: { clientId, weekOf: weekOfInstant(weekKey), isDone: false },
    select: {
      id: true,
      title: true,
      isDone: true,
      assignee: { select: { name: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <Card padding="md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-ink-muted" />
            <p className="eyebrow">Prioridades de esta semana</p>
          </div>
          <p className="mt-1 text-xs text-ink-muted">{weekRangeLabel(weekKey)}</p>
        </div>
        <Link
          href="/priorities"
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink-secondary transition-colors hover:text-accent2"
        >
          Ver todas
          <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted transition-colors group-hover:text-accent2" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin prioridades pendientes para este cliente esta semana.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <PriorityToggle
              key={item.id}
              id={item.id}
              title={item.title}
              isDone={item.isDone}
              assigneeName={item.assignee?.name ?? null}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
