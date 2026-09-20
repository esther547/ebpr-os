"use client";

import { format } from "date-fns";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";

type AgendaItem = {
  id: string;
  eventName?: string | null;
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

const STATUS_TONES: Record<string, BadgeTone> = {
  SCHEDULED: "neutral",
  CONFIRMED: "warning",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Goal",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

export function AgendaMonthSection({ monthNumber, monthLabel, items, runners: _runners }: Props) {
  const sorted = [...items].sort((a, b) => {
    if (a.agendaSequence !== null && b.agendaSequence !== null) {
      return a.agendaSequence - b.agendaSequence;
    }
    return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
  });

  return (
    <section>
      <SectionHeader
        title={`Mes ${monthNumber}`}
        description={monthLabel}
        actions={<span className="tabular text-xs text-ink-muted">{items.length} items</span>}
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>Date</Th>
              <Th>Arrival / Time</Th>
              <Th>Venue</Th>
              <Th>Item</Th>
              <Th>PR Runner</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <AgendaItemRow key={item.id} item={item} seq={item.agendaSequence ?? i + 1} />
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

function AgendaItemRow({ item, seq }: { item: AgendaItem; seq: number }) {
  const needsRunner =
    !item.runner && (item.status === "SCHEDULED" || item.status === "CONFIRMED");
  const date = new Date(item.eventDate);
  const arrivalTime = item.arrivalTime ? new Date(item.arrivalTime) : null;
  const eventTime = item.eventTime ? new Date(item.eventTime) : null;

  return (
    <tr className={needsRunner ? "bg-red-50/40" : undefined}>
      <Td numeric className="text-xs font-semibold text-ink-muted">
        {seq}
      </Td>

      <Td>
        <p className="text-xs font-semibold text-ink-primary">{format(date, "EEE")}</p>
        <p className="tabular text-xs text-ink-secondary">{format(date, "MM/dd/yy")}</p>
      </Td>

      <Td>
        {arrivalTime && (
          <p className="tabular text-2xs text-ink-muted">Llegada: {format(arrivalTime, "h:mm a")}</p>
        )}
        <p className="tabular text-xs font-medium text-ink-primary">
          {eventTime ? format(eventTime, "h:mm a") : "—"}
        </p>
      </Td>

      <Td className="max-w-[200px]">
        {item.venueName ? (
          <>
            <p className="truncate text-xs font-medium text-ink-primary">{item.venueName}</p>
            {item.venueAddress && <p className="truncate text-2xs text-ink-muted">{item.venueAddress}</p>}
          </>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>

      <Td>
        <div className="flex flex-col items-start gap-1">
          {item.itemType && (
            <Badge size="xs" tone="outline" className="uppercase tracking-wide">
              {item.itemType}
            </Badge>
          )}
          <p className="text-xs font-medium text-ink-primary">{item.eventName || item.notes || "—"}</p>
          {item.eventName && item.notes && <p className="text-2xs text-ink-muted">{item.notes}</p>}
          {(item.accompanistCount ?? 0) > 0 && (
            <p className="text-2xs text-ink-muted">Acompañante +{item.accompanistCount}</p>
          )}
        </div>
      </Td>

      <Td>
        {item.runner ? (
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-secondary ring-1 ring-inset ring-border">
              {(item.runner.name?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="text-xs text-ink-secondary">{item.runner.name.split(" ")[0]}</span>
          </div>
        ) : needsRunner ? (
          // Still open: the auto-scheduler (or the team) has to pick someone.
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-muted">—</span>
            <Badge size="xs" tone="danger" dot>
              Needs runner
            </Badge>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>

      <Td>
        <Badge size="xs" tone={STATUS_TONES[item.status] ?? "neutral"} dot>
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </Td>
    </tr>
  );
}
