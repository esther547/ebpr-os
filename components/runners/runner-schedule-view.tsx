"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight, MapPin, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey, formatDayKey, formatInTz } from "@/components/runners/miami-time";
import { Badge, statusTone, humanize } from "@/components/ui/badge";
import { Button } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Runner = { id: string; name: string; avatar: string | null };

export type ScheduleAssignment = {
  id: string;
  /** Null while the activity still needs a runner. */
  runnerId: string | null;
  /** Client the activity belongs to (shown before the activity name). */
  clientName?: string | null;
  eventName: string;
  eventDate: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  location: string | null;
  venueName: string | null;
  status: string;
  autoAssigned: boolean;
  runner: { id: string; name: string; avatar: string | null } | null;
};

type Props = {
  assignments: ScheduleAssignment[];
  runners: Runner[];
  /** Monday of the displayed week, "yyyy-MM-dd" (Miami). */
  weekStartKey: string;
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  currentWeekKey: string;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
  isReadOnly: boolean;
  /** Open the "assign a runner" picker for one activity. */
  onAssign?: (assignment: ScheduleAssignment) => void;
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const NEEDS_RUNNER = "NEEDS_RUNNER";

/** Up to two initials. */
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function RunnerScheduleView({
  assignments,
  runners,
  weekStartKey,
  currentWeekKey,
  todayKey,
  isReadOnly,
  onAssign,
}: Props) {
  const [runnerFilter, setRunnerFilter] = useState<string>("ALL");

  const days = WEEK_DAYS.map((label, i) => ({
    label,
    key: addDaysKey(weekStartKey, i),
  }));

  const needsRunnerCount = assignments.filter((a) => !a.runnerId).length;

  const visible =
    runnerFilter === "ALL"
      ? assignments
      : runnerFilter === NEEDS_RUNNER
        ? assignments.filter((a) => !a.runnerId)
        : assignments.filter((a) => a.runnerId === runnerFilter);

  return (
    <div className="space-y-4">
      {/* Week navigation + runner filter */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="secondary"
            size="icon-sm"
            aria-label="Previous week"
          >
            <Link href={`/runners/schedule?week=${addDaysKey(weekStartKey, -7)}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="icon-sm" aria-label="Next week">
            <Link href={`/runners/schedule?week=${addDaysKey(weekStartKey, 7)}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-sm text-ink-muted">
            Week of{" "}
            <span className="font-medium text-ink-primary">
              {formatDayKey(weekStartKey, "MMMM d, yyyy")}
            </span>
            {weekStartKey === currentWeekKey ? (
              <span className="ml-2 text-xs text-ink-muted">(this week)</span>
            ) : (
              <Link
                href="/runners/schedule"
                className="ml-2 text-xs font-medium text-ink-secondary underline-offset-2 hover:underline"
              >
                Back to this week
              </Link>
            )}
          </p>
        </div>

        {runners.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            <FilterChip active={runnerFilter === "ALL"} onClick={() => setRunnerFilter("ALL")}>
              All runners
            </FilterChip>
            {needsRunnerCount > 0 && (
              <FilterChip
                active={runnerFilter === NEEDS_RUNNER}
                onClick={() => setRunnerFilter(NEEDS_RUNNER)}
                tone="danger"
              >
                Needs runner · {needsRunnerCount}
              </FilterChip>
            )}
            {runners.map((r) => (
              <FilterChip
                key={r.id}
                active={runnerFilter === r.id}
                onClick={() => setRunnerFilter(r.id)}
              >
                {r.name.split(" ")[0]}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {runners.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 />}
          title="No runners yet"
          description="Add a runner to start building the weekly schedule."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map(({ label, key }) => {
            const dayAssignments = visible
              .filter((a) => a.dayKey === key)
              // Activities that still need a runner come first in their day.
              .sort(
                (a, b) =>
                  Number(!!a.runnerId) - Number(!!b.runnerId) ||
                  a.eventDate.localeCompare(b.eventDate)
              );
            const isToday = key === todayKey;

            return (
              <Card
                key={key}
                padding="none"
                className={cn(
                  "flex min-h-[160px] flex-col overflow-hidden",
                  isToday && "border-ink-primary ring-1 ring-ink-primary/10"
                )}
              >
                <div
                  className={cn(
                    "flex items-baseline justify-between gap-2 border-b border-border px-3 py-2",
                    isToday ? "bg-ink-primary text-ink-inverted" : "bg-surface-2"
                  )}
                >
                  <span
                    className={cn(
                      "text-2xs font-semibold uppercase tracking-[0.14em]",
                      isToday ? "text-ink-inverted" : "text-ink-muted"
                    )}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular",
                      isToday ? "text-ink-inverted" : "text-ink-primary"
                    )}
                  >
                    {formatDayKey(key, "d")}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-2">
                  {dayAssignments.length === 0 ? (
                    <p className="py-4 text-center text-2xs text-ink-muted">No assignments</p>
                  ) : (
                    dayAssignments.map((a) => {
                      const needsRunner = !a.runnerId;
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "rounded-lg border p-2 transition-colors",
                            needsRunner
                              ? "border-red-200 bg-red-50/60 hover:border-red-300"
                              : "border-border bg-surface-1 hover:border-border-strong hover:bg-white"
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-1.5">
                            <span className="text-2xs font-semibold tabular text-ink-secondary">
                              {formatInTz(a.eventDate, TIME)}
                            </span>
                            {needsRunner ? (
                              <Badge tone="danger" size="xs" dot>
                                Needs runner
                              </Badge>
                            ) : (
                              <Badge tone={statusTone(a.status)} size="xs">
                                {humanize(a.status)}
                              </Badge>
                            )}
                          </div>

                          {a.clientName && (
                            <p className="truncate text-2xs font-semibold uppercase tracking-wide text-accent2-ink" title={a.clientName}>
                              {a.clientName}
                            </p>
                          )}
                          <p
                            className="truncate text-xs font-medium text-ink-primary"
                            title={a.eventName}
                          >
                            {a.eventName}
                          </p>

                          {(a.venueName || a.location) && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-2xs text-ink-muted">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{a.venueName || a.location}</span>
                            </p>
                          )}

                          {a.runner ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-ink-secondary">
                                {initials(a.runner.name)}
                              </span>
                              <span className="truncate text-2xs text-ink-secondary">
                                {a.runner.name.split(" ")[0]}
                              </span>
                              {a.autoAssigned && (
                                <span
                                  className="text-2xs text-ink-muted"
                                  title="Chosen automatically from this runner's availability"
                                >
                                  · auto
                                </span>
                              )}
                            </div>
                          ) : (
                            !isReadOnly &&
                            onAssign && (
                              <Button
                                variant="secondary"
                                size="xs"
                                className="mt-1.5 w-full"
                                leftIcon={<UserPlus className="h-3 w-3" />}
                                onClick={() => onAssign(a)}
                              >
                                Assign
                              </Button>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors",
        active
          ? tone === "danger"
            ? "border-red-600 bg-red-600 text-white"
            : "border-ink-primary bg-ink-primary text-ink-inverted"
          : tone === "danger"
            ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300"
            : "border-border bg-white text-ink-secondary hover:border-border-strong hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}
