"use client";

import { format } from "date-fns";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserPlus, Check, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuDots, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { EditAgendaItemModal } from "./edit-agenda-item-modal";

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
  runners?: { id: string; name: string; role?: string }[];
  clientId?: string;
  canEdit?: boolean;
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

export function AgendaMonthSection({ monthNumber, monthLabel, items, runners = [], clientId, canEdit = true }: Props) {
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
              {canEdit && clientId && <Th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <AgendaItemRow key={item.id} item={item} seq={item.agendaSequence ?? i + 1} clientId={canEdit ? clientId : undefined} runners={runners} />
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

function AgendaItemRow({ item, seq, clientId, runners }: { item: AgendaItem; seq: number; clientId?: string; runners: { id: string; name: string; role?: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"COMPLETED" | "CANCELLED" | null>(null);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "COMPLETED" | "CANCELLED") {
    if (!clientId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/agenda/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo actualizar"), variant: "error" }); return; }
      toast({ title: status === "COMPLETED" ? "Pauta completada" : "Pauta cancelada", variant: "success" });
      router.refresh();
    } finally { setBusy(false); setConfirm(null); }
  }

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

      {clientId && (
        <Td align="right">
          <DropdownMenu>
            <DropdownMenuDots label="Acciones de la pauta" />
            <DropdownMenuContent>
              <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>Editar pauta</DropdownMenuItem>
              <DropdownMenuItem icon={<UserPlus />} onSelect={() => setEditing(true)}>{item.runner ? "Cambiar runner" : "Asignar runner"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {item.status !== "COMPLETED" && (
                <DropdownMenuItem icon={<Check />} onSelect={() => setConfirm("COMPLETED")}>Marcar completada</DropdownMenuItem>
              )}
              {item.status !== "CANCELLED" && (
                <DropdownMenuItem icon={<XCircle />} destructive onSelect={() => setConfirm("CANCELLED")}>Cancelar pauta</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {editing && (
            <EditAgendaItemModal open={editing} onOpenChange={setEditing} clientId={clientId} item={item} runners={runners} />
          )}
          <ConfirmModal
            open={!!confirm}
            onOpenChange={(o) => { if (!o) setConfirm(null); }}
            title={confirm === "COMPLETED" ? "¿Marcar la pauta como completada?" : "¿Cancelar esta pauta?"}
            description={item.eventName ?? undefined}
            confirmLabel={confirm === "COMPLETED" ? "Completar" : "Cancelar pauta"}
            destructive={confirm === "CANCELLED"}
            loading={busy}
            onConfirm={async () => { if (confirm) await setStatus(confirm); }}
          />
        </Td>
      )}
    </tr>
  );
}
