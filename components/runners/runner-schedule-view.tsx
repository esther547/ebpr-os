"use client";

import { format, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { RunnerScheduleEntry } from "@/types";

type Runner = { id: string; name: string; avatar: string | null };

type Props = {
  assignments: RunnerScheduleEntry[];
  runners: Runner[];
  weekStart: Date;
  isReadOnly: boolean;
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
  CONFIRMED: "bg-green-50 text-green-700 border-green-100",
  COMPLETED: "bg-surface-2 text-ink-secondary border-border",
  CANCELLED: "bg-red-50 text-red-600 border-red-100",
};

export function RunnerScheduleView({
  assignments,
  runners,
  weekStart,
  isReadOnly,
}: Props) {
  const days = WEEK_DAYS.map((label, i) => ({
    label,
    date: addDays(weekStart, i),
  }));

  return (
    <div>
      {/* Week label */}
      <p className="mb-4 text-sm text-ink-muted">
        Week of{" "}
        <span className="font-medium text-ink-primary">
          {format(weekStart, "MMMM d, yyyy")}
        </span>
      </p>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-border">
          {days.map(({ label, date }) => (
            <div
              key={label}
              className={cn(
                "px-3 py-3 text-center border-r border-border last:border-r-0",
                isSameDay(date, new Date()) && "bg-surface-2"
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium",
                  isSameDay(date, new Date())
                    ? "text-ink-primary"
                    : "text-ink-secondary"
                )}
              >
                {format(date, "d")}
              </p>
            </div>
          ))}
        </div>

        {/* Runner rows */}
        {runners.map((runner) => (
          <div
            key={runner.id}
            className="grid grid-cols-7 border-b border-border last:border-b-0 min-h-[80px]"
          >
            {days.map(({ date }, i) => {
              const dayAssignments = assignments.filter(
                (a) =>
                  a.runnerId === runner.id && isSameDay(new Date(a.eventDate), date)
              );

              return (
                <div
                  key={i}
                  className={cn(
                    "p-2 border-r border-border last:border-r-0 relative",
                    isSameDay(date, new Date()) && "bg-surface-1"
                  )}
                >
                  {/* Runner name (only first column) */}
                  {i === 0 && (
                    <p className="text-xs font-medium text-ink-primary mb-1.5 truncate">
                      {runner.name.split(" ")[0]}
                    </p>
                  )}
                  {dayAssignments.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded border px-2 py-1 text-xs mb-1",
                        STATUS_STYLES[a.status]
                      )}
                    >
                      <p className="font-medium truncate">{a.eventName}</p>
                      {a.location && (
                        <p className="truncate opacity-80">{a.location}</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        {runners.length === 0 && (
          <div className="py-16 text-center text-sm text-ink-muted">
            No runners in the system yet.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-ink-muted">
        {Object.entries(STATUS_STYLES).map(([status, styles]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-sm border", styles)} />
            <span className="capitalize">{status.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
