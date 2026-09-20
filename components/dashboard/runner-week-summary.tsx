"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey, formatDayKey } from "@/components/runners/miami-time";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Runner = { id: string; name: string };
type Assignment = {
  id: string;
  /** Null while the activity still needs a runner. */
  runnerId: string | null;
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

/** Up to two initials. */
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function RunnerWeekSummary({ runners, assignments, weekStartKey, todayKey }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStartKey, i));

  // Group assignments by runner for detail view
  const byRunner = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!a.runnerId) continue; // still needs a runner — not on anyone's plate yet
    const arr = byRunner.get(a.runnerId) ?? [];
    arr.push(a);
    byRunner.set(a.runnerId, arr);
  }

  return (
    <Card>
      <CardHeader
        title="Runners"
        actions={
          <Link
            href="/runners/schedule"
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink-primary"
          >
            Full schedule
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />

      {runners.length === 0 ? (
        <EmptyState compact title="No runners" description="No runners in the system yet." />
      ) : (
        <div className="divide-y divide-border">
          {runners.map((runner, idx) => {
            const myItems = byRunner.get(runner.id) ?? [];
            return (
              <div key={runner.id} className={cn("py-3", idx === 0 && "pt-0")}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-secondary ring-1 ring-inset ring-border">
                      {initials(runner.name)}
                    </span>
                    <span className="truncate text-sm font-medium text-ink-primary">
                      {runner.name.split(" ")[0]}
                    </span>
                  </div>
                  <Badge tone={myItems.length > 0 ? "dark" : "neutral"} size="xs">
                    {myItems.length === 0
                      ? "Free"
                      : `${myItems.length} event${myItems.length !== 1 ? "s" : ""}`}
                  </Badge>
                </div>

                {/* Day availability strip */}
                <div className="flex gap-1">
                  {days.map((day) => {
                    const event = myItems.find((a) => a.dayKey === day);
                    return (
                      <div
                        key={day}
                        title={
                          event
                            ? `${formatDayKey(day, "EEE MMM d")}: ${event.eventName}`
                            : formatDayKey(day, "EEE MMM d")
                        }
                        className={cn(
                          "flex h-6 flex-1 items-center justify-center rounded-md text-2xs font-medium tabular transition-colors",
                          event
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
                  <ul className="mt-2 space-y-0.5">
                    {myItems.slice(0, 3).map((a) => (
                      <li key={a.id} className="truncate text-2xs text-ink-muted">
                        <span className="font-medium text-ink-secondary">
                          {formatDayKey(a.dayKey, "EEE d")}
                        </span>{" "}
                        · {a.eventName}
                        {a.location && ` · ${a.location}`}
                        {a.status === "COMPLETED" && " · done"}
                      </li>
                    ))}
                    {myItems.length > 3 && (
                      <li className="text-2xs text-ink-muted">+{myItems.length - 3} more</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
