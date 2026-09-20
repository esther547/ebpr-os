"use client";

import { useState } from "react";
import { CalendarX2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey, formatDayKey, formatInTz } from "@/components/runners/miami-time";
import { Badge, statusTone, humanize } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Runner = { id: string; name: string; avatar: string | null };

export type ScheduleAssignment = {
  id: string;
  runnerId: string;
  eventName: string;
  eventDate: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  location: string | null;
  venueName: string | null;
  status: string;
  runner: { id: string; name: string; avatar: string | null } | null;
};

type Props = {
  assignments: ScheduleAssignment[];
  runners: Runner[];
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  weekStartKey: string;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
  isReadOnly: boolean;
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

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
  todayKey,
}: Props) {
  const [runnerFilter, setRunnerFilter] = useState<string>("ALL");

  const days = WEEK_DAYS.map((label, i) => ({
    label,
    key: addDaysKey(weekStartKey, i),
  }));

  const visible =
    runnerFilter === "ALL"
      ? assignments
      : assignments.filter((a) => a.runnerId === runnerFilter);

  return (
    <div className="space-y-4">
      {/* Week label + runner filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Week of{" "}
          <span className="font-medium text-ink-primary">
            {formatDayKey(weekStartKey, "MMMM d, yyyy")}
          </span>
        </p>

        {runners.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            <FilterChip
              active={runnerFilter === "ALL"}
              onClick={() => setRunnerFilter("ALL")}
            >
              All runners
            </FilterChip>
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
              .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
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
                    dayAssignments.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-border bg-surface-1 p-2 transition-colors hover:border-border-strong hover:bg-white"
                      >
                        <div className="mb-1 flex items-center justify-between gap-1.5">
                          <span className="text-2xs font-semibold tabular text-ink-secondary">
                            {formatInTz(a.eventDate, TIME)}
                          </span>
                          <Badge tone={statusTone(a.status)} size="xs">
                            {humanize(a.status)}
                          </Badge>
                        </div>

                        <p className="truncate text-xs font-medium text-ink-primary" title={a.eventName}>
                          {a.eventName}
                        </p>

                        {(a.venueName || a.location) && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-2xs text-ink-muted">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{a.venueName || a.location}</span>
                          </p>
                        )}

                        {a.runner && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-ink-secondary">
                              {initials(a.runner.name)}
                            </span>
                            <span className="truncate text-2xs text-ink-secondary">
                              {a.runner.name.split(" ")[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors",
        active
          ? "border-ink-primary bg-ink-primary text-ink-inverted"
          : "border-border bg-white text-ink-secondary hover:border-border-strong hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}
