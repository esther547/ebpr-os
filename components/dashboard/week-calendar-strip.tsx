"use client";

import { cn } from "@/lib/utils";
import { addDaysKey, formatDayKey } from "@/components/runners/miami-time";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";

type Event = {
  id: string;
  eventName: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  location: string | null;
  clientId: string | null;
  status: string;
  runner: { id: string; name: string } | null;
};

type Props = {
  events: Event[];
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  weekStartKey: string;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  CONFIRMED: "bg-emerald-500",
  COMPLETED: "bg-ink-muted",
  CANCELLED: "bg-red-400",
};

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekCalendarStrip({ events, weekStartKey, todayKey }: Props) {
  const days = DAYS.map((label, i) => ({
    label,
    key: addDaysKey(weekStartKey, i),
  }));

  const hasEvents = events.length > 0;

  return (
    <Card>
      <CardHeader
        title="This Week"
        actions={
          <span className="text-xs text-ink-muted">
            {formatDayKey(weekStartKey, "MMM d")} –{" "}
            {formatDayKey(addDaysKey(weekStartKey, 6), "MMM d")}
          </span>
        }
      />

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ label, key }) => (
          <div key={key} className="text-center">
            <p className="eyebrow">{label}</p>
            <p
              className={cn(
                "mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular",
                key === todayKey
                  ? "bg-ink-primary text-ink-inverted"
                  : "text-ink-secondary"
              )}
            >
              {formatDayKey(key, "d")}
            </p>
          </div>
        ))}
      </div>

      {/* Event chips per day */}
      {hasEvents ? (
        <div className="mt-2 grid min-h-[56px] grid-cols-7 gap-1">
          {days.map(({ key }) => {
            const dayEvents = events.filter((e) => e.dayKey === key);
            return (
              <div key={key} className="flex min-h-[56px] flex-col gap-1">
                {dayEvents.map((e) => (
                  <div
                    key={e.id}
                    title={`${e.eventName}${e.location ? ` · ${e.location}` : ""}`}
                    className="rounded-md bg-surface-2 px-1 py-1 transition-colors hover:bg-surface-3"
                  >
                    <span
                      className={cn(
                        "mx-auto block h-1.5 w-1.5 rounded-full",
                        STATUS_DOT[e.status] ?? "bg-ink-muted"
                      )}
                    />
                    <p className="mt-0.5 truncate text-center text-2xs font-medium leading-tight text-ink-primary">
                      {e.eventName}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border py-6 text-center text-xs text-ink-muted">
          No events scheduled this week.
        </p>
      )}

      <CardFooter>
        <p className="text-xs text-ink-muted">
          <span className="font-semibold tabular text-ink-primary">{events.length}</span>{" "}
          event{events.length !== 1 ? "s" : ""} this week
        </p>
      </CardFooter>
    </Card>
  );
}
