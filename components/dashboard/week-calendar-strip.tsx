"use client";

import { format, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  eventName: string;
  eventDate: Date;
  location: string | null;
  clientId: string | null;
  status: string;
  runner: { id: string; name: string } | null;
};

type Props = {
  events: Event[];
  weekStart: Date;
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  CONFIRMED: "bg-green-500",
  COMPLETED: "bg-ink-muted",
  CANCELLED: "bg-red-400",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekCalendarStrip({ events, weekStart }: Props) {
  const days = DAYS.map((label, i) => ({
    label,
    date: addDays(weekStart, i),
  }));

  const today = new Date();
  const hasEvents = events.length > 0;

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ink-primary">This Week</h3>
        <span className="text-xs text-ink-muted">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {days.map(({ label, date }) => (
          <div key={label} className="text-center">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">
              {label}
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center mx-auto",
                isSameDay(date, today)
                  ? "bg-ink-primary text-ink-inverted"
                  : "text-ink-secondary"
              )}
            >
              {format(date, "d")}
            </p>
          </div>
        ))}
      </div>

      {/* Event dots per day */}
      <div className="grid grid-cols-7 gap-0.5 min-h-[48px]">
        {days.map(({ date }, i) => {
          const dayEvents = events.filter((e) =>
            isSameDay(new Date(e.eventDate), date)
          );
          return (
            <div key={i} className="flex flex-col gap-1 min-h-[48px]">
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  title={`${e.eventName}${e.location ? ` · ${e.location}` : ""}`}
                  className="rounded px-1 py-0.5 bg-surface-2 hover:bg-surface-3 cursor-default transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                        STATUS_DOT[e.status] ?? "bg-ink-muted"
                      )}
                    />
                    <p className="text-2xs text-ink-primary font-medium truncate leading-tight">
                      {e.eventName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!hasEvents && (
        <p className="text-xs text-ink-muted text-center py-4">
          No events scheduled this week.
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-ink-muted">
          <span className="font-semibold text-ink-primary">{events.length}</span>{" "}
          event{events.length !== 1 ? "s" : ""} this week
        </p>
      </div>
    </div>
  );
}
