"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { addDaysKey, formatDayKey } from "@/components/runners/miami-time";

type Runner = { id: string; name: string };
type Assignment = {
  id: string;
  runnerId: string;
  eventName: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  location: string | null;
  status: string;
  runner: { id: string; name: string } | null;
};

type Props = {
  runners: Runner[];
  assignments: Assignment[];
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  weekStartKey: string;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
};

export function RunnerWeekSummary({ runners, assignments, weekStartKey, todayKey }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStartKey, i));

  // Per runner: count of days assigned this week
  const runnerSummary = runners.map((runner) => {
    const myAssignments = assignments.filter((a) => a.runnerId === runner.id);
    const daysWorking = days.filter((d) =>
      myAssignments.some((a) => a.dayKey === d)
    ).length;
    return { ...runner, count: myAssignments.length, daysWorking };
  });

  // Group assignments by runner for detail view
  const byRunner = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const arr = byRunner.get(a.runnerId) ?? [];
    arr.push(a);
    byRunner.set(a.runnerId, arr);
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ink-primary">Runners</h3>
        <Link
          href="/runners/schedule"
          className="text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors"
        >
          Full schedule →
        </Link>
      </div>

      {runners.length === 0 ? (
        <p className="text-xs text-ink-muted py-4 text-center">
          No runners in the system.
        </p>
      ) : (
        <div className="space-y-3">
          {runnerSummary.map((runner) => {
            const myItems = byRunner.get(runner.id) ?? [];
            return (
              <div key={runner.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div className="h-6 w-6 rounded-full bg-surface-3 flex items-center justify-center text-2xs font-bold text-ink-secondary flex-shrink-0">
                      {runner.name[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-ink-primary">
                      {runner.name.split(" ")[0]}
                    </span>
                  </div>
                  <span className="text-2xs text-ink-muted">
                    {runner.count === 0
                      ? "Free this week"
                      : `${runner.count} event${runner.count !== 1 ? "s" : ""}`}
                  </span>
                </div>

                {/* Day availability dots */}
                <div className="flex gap-1">
                  {days.map((day, i) => {
                    const event = myItems.find((a) => a.dayKey === day);
                    const hasEvent = !!event;
                    return (
                      <div
                        key={i}
                        title={
                          event
                            ? `${formatDayKey(day, "EEE MMM d")}: ${event.eventName}`
                            : formatDayKey(day, "EEE MMM d")
                        }
                        className={cn(
                          "flex-1 h-5 rounded-sm text-center flex items-center justify-center text-2xs font-medium transition-colors",
                          hasEvent
                            ? "bg-ink-primary text-ink-inverted"
                            : day === todayKey
                            ? "bg-surface-3 text-ink-secondary"
                            : "bg-surface-2 text-ink-muted"
                        )}
                      >
                        {formatDayKey(day, "d")}
                      </div>
                    );
                  })}
                </div>

                {/* Assignments detail */}
                {myItems.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {myItems.slice(0, 3).map((a) => (
                      <p key={a.id} className="text-2xs text-ink-muted truncate">
                        <span className="font-medium text-ink-secondary">
                          {formatDayKey(a.dayKey, "EEE d")}
                        </span>{" "}
                        · {a.eventName}
                        {a.location && ` · ${a.location}`}
                        {a.status === "COMPLETED" && " · done"}
                      </p>
                    ))}
                    {myItems.length > 3 && (
                      <p className="text-2xs text-ink-muted">
                        +{myItems.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
