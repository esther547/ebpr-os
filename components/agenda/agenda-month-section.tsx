"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";

type AgendaItem = {
  id: string;
  eventDate: Date | string;
  arrivalTime: Date | string | null;
  eventTime: Date | string | null;
  venueName: string | null;
  venueAddress: string | null;
  itemType: string | null;
  accompanistCount: number | null;
  agendaSequence: number | null;
  status: string;
  notes: string | null;
  runner: { id: string; name: string } | null;
};

type Props = {
  monthNumber: number;
  monthLabel?: string;
  items: AgendaItem[];
  runners?: { id: string; name: string }[];
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-stone-100 text-stone-600 border-stone-200",
  CONFIRMED: "bg-stone-800 text-white border-stone-800",
  IN_PROGRESS: "bg-stone-200 text-stone-700 border-stone-300",
  COMPLETED: "bg-black text-white border-black",
  CANCELLED: "bg-red-50 text-red-600 border-red-100 line-through",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Goal",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

const TYPE_STYLES: Record<string, string> = {
  TV: "bg-black text-white",
  PODCAST: "bg-stone-700 text-white",
  "RED CARPET": "bg-stone-500 text-white",
  EVENT: "bg-stone-300 text-stone-800",
  INTERVIEW: "bg-stone-200 text-stone-700",
  PHOTOSHOOT: "bg-stone-100 text-stone-600",
  RADIO: "bg-stone-400 text-white",
  DIGITAL: "bg-stone-600 text-white",
  PRESS: "bg-stone-350 text-white",
  "AWARD SHOW": "bg-stone-800 text-white",
};

export function AgendaMonthSection({ monthNumber, monthLabel: _monthLabel, items, runners: _runners }: Props) {
  const sorted = [...items].sort((a, b) => {
    if (a.agendaSequence !== null && b.agendaSequence !== null) {
      return a.agendaSequence - b.agendaSequence;
    }
    return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
  });

  return (
    <section>
      {/* Month header */}
      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
            {monthNumber}
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-ink-primary">
            MES {monthNumber}
          </span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-ink-muted">{items.length} items</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-1">
              <th className="w-8 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Date
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Arrival / Time
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Venue
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Item
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                PR Runner
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((item, i) => (
              <AgendaItemRow
                key={item.id}
                item={item}
                seq={item.agendaSequence ?? i + 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AgendaItemRow({
  item,
  seq,
}: {
  item: AgendaItem;
  seq: number;
}) {
  const date = new Date(item.eventDate);
  const arrivalTime = item.arrivalTime ? new Date(item.arrivalTime) : null;
  const eventTime = item.eventTime ? new Date(item.eventTime) : null;

  return (
    <tr className="hover:bg-surface-1 transition-colors">
      {/* # */}
      <td className="px-3 py-3.5 text-xs font-semibold text-ink-muted">
        {seq}
      </td>

      {/* Date */}
      <td className="px-3 py-3.5">
        <p className="text-xs font-semibold text-ink-primary">
          {format(date, "EEE")}
        </p>
        <p className="text-xs text-ink-secondary">
          {format(date, "MM/dd/yy")}
        </p>
      </td>

      {/* Arrival / Air time */}
      <td className="px-3 py-3.5">
        {arrivalTime && (
          <p className="text-[10px] text-ink-muted">
            Llegada: {format(arrivalTime, "h:mm a")}
          </p>
        )}
        <p className="text-xs font-medium text-ink-primary">
          {eventTime ? format(eventTime, "h:mm a") : format(date, "h:mm a")}
        </p>
      </td>

      {/* Venue */}
      <td className="px-3 py-3.5 max-w-[200px]">
        {item.venueName ? (
          <>
            <p className="text-xs font-medium text-ink-primary truncate">
              {item.venueName}
            </p>
            {item.venueAddress && (
              <p className="text-[10px] text-ink-muted truncate">
                {item.venueAddress}
              </p>
            )}
          </>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </td>

      {/* Item name + type */}
      <td className="px-3 py-3.5">
        <div className="flex flex-col gap-1">
          {item.itemType && (
            <span
              className={cn(
                "self-start rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                TYPE_STYLES[item.itemType.toUpperCase()] ??
                  "bg-surface-2 text-ink-secondary"
              )}
            >
              {item.itemType}
            </span>
          )}
          <p className="text-xs font-medium text-ink-primary">
            {item.notes || "—"}
          </p>
          {(item.accompanistCount ?? 0) > 0 && (
            <p className="text-[10px] text-ink-muted">
              Acompañante +{item.accompanistCount}
            </p>
          )}
        </div>
      </td>

      {/* Runner */}
      <td className="px-3 py-3.5">
        {item.runner ? (
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-bold text-ink-secondary flex-shrink-0">
              {item.runner.name[0].toUpperCase()}
            </div>
            <div>
              <span className="text-xs text-ink-secondary block">
                {item.runner.name.split(" ")[0]}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3.5">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
            STATUS_STYLES[item.status] ??
              "bg-surface-2 text-ink-secondary border-border"
          )}
        >
          {STATUS_LABELS[item.status] ?? item.status}
        </span>
      </td>
    </tr>
  );
}
