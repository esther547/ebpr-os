"use client";

import { format } from "date-fns";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserPlus, Check, XCircle, Layers } from "lucide-react";
import { DropdownMenu, DropdownMenuDots, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { Button, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
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
  internalNotes?: string | null;
  runner: { id: string; name: string } | null;
  /** Service-period data (lib/service-periods.ts). */
  unitState?: "scheduled" | "closed_pending" | "executed" | "cancelled";
  periodId?: string | null;
  coversPeriod?: boolean;
  periodNote?: string | null;
  /** Goals this pauta is worth (1 by default). */
  goalValue?: number;
  /** No closing date on record: the period is a placement to confirm. */
  needsReview?: boolean;
  /** A proposal from the doc ("Pending"): not confirmed, does not count. */
  isProposal?: boolean;
};

export type PeriodOption = { id: string; number: number; label: string; target: number };

type Props = {
  monthNumber: number;
  monthLabel?: string;
  /** Goals this service month should hold (client.monthlyTarget). */
  target?: number;
  items: AgendaItem[];
  runners?: { id: string; name: string; role?: string }[];
  clientId?: string;
  canEdit?: boolean;
  /** When given, each row gets a period selector and the "covers the period" action. */
  periods?: PeriodOption[];
  /** Custom title/description (period board); defaults to "Mes N". */
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hide the header entirely (e.g. inside a period card that has its own). */
  hideHeader?: boolean;
};

const UNIT_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Programada", tone: "neutral" },
  closed_pending: { label: "Cerrada · pendiente de ejecución", tone: "warning" },
  executed: { label: "Ejecutada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
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

export function AgendaMonthSection({ monthNumber, monthLabel, target = 0, items, runners = [], clientId, canEdit = true, periods, title, description, actions, hideHeader = false }: Props) {
  // Items arrive in report order (lib/agenda-months.ts); the number is the row's place in its MES.
  const sorted = items;

  return (
    <section>
      {!hideHeader && (
        <SectionHeader
          title={title ?? `Mes ${monthNumber}`}
          description={description ?? monthLabel}
          actions={
            actions ?? (
              <span className={`tabular text-xs font-medium ${target > 0 && items.length >= target ? "text-emerald-700" : "text-ink-muted"}`}>
                {target > 0 ? `${items.length} de ${target} metas` : `${items.length} items`}
              </span>
            )
          }
        />
      )}

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
              {periods && <Th>Período</Th>}
              {periods && <Th>Vale</Th>}
              {canEdit && clientId && <Th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Goal numbers run through the block: an activity worth k goals takes k consecutive numbers.
              let next = 1;
              return sorted.map((item) => {
                const v = periods ? Math.max(item.coversPeriod ? target : item.goalValue ?? 1, 1) : 1;
                const first = next; next += v;
                const label = v === 1 ? String(first) : `${first}–${first + v - 1}`;
                return <AgendaItemRow key={item.id} item={item} seq={first} seqLabel={label} clientId={canEdit ? clientId : undefined} runners={runners} periods={periods} patchClientId={clientId} />;
              });
            })()}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

function AgendaItemRow({ item, seq, seqLabel, clientId, runners, periods, patchClientId }: { item: AgendaItem; seq: number; seqLabel?: string; clientId?: string; runners: { id: string; name: string; role?: string }[]; periods?: PeriodOption[]; patchClientId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"COMPLETED" | "CANCELLED" | null>(null);
  const [busy, setBusy] = useState(false);
  const [covers, setCovers] = useState(false);
  const [coverNote, setCoverNote] = useState(item.periodNote ?? "");

  async function patchPeriod(body: Record<string, unknown>) {
    const cid = patchClientId ?? clientId;
    if (!cid) return;
    const res = await fetch(`/api/clients/${cid}/agenda/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo guardar"), variant: "error" }); return; }
    router.refresh();
  }

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
        {seqLabel ?? seq}
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
          {item.internalNotes && (
            <p className="text-2xs text-amber-800" title="Notas internas · el cliente nunca las ve">🔒 {item.internalNotes}</p>
          )}
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
        {item.unitState ? (
          <div className="flex flex-col items-start gap-1">
            <Badge size="xs" tone={UNIT_STATE[item.unitState].tone} dot>{UNIT_STATE[item.unitState].label}</Badge>
            {item.coversPeriod && <span title={item.periodNote ?? undefined}><Badge size="xs" tone="purple">Cubre el período</Badge></span>}
            {!item.coversPeriod && (item.goalValue ?? 1) > 1 && <Badge size="xs" tone="purple">Vale {item.goalValue} metas</Badge>}
            {item.isProposal && <Badge size="xs" tone="outline">Propuesta · no cuenta</Badge>}
            {item.needsReview && !item.isProposal && <span title="No hay fecha de cierre registrada; el período es una ubicación por confirmar"><Badge size="xs" tone="warning">Sin fecha de cierre · revisar</Badge></span>}
          </div>
        ) : (
          <Badge size="xs" tone={STATUS_TONES[item.status] ?? "neutral"} dot>
            {STATUS_LABELS[item.status] ?? item.status}
          </Badge>
        )}
      </Td>
      {periods && (
        <Td>
          {clientId ? (
            <select
              value={item.periodId ?? ""}
              onChange={(e) => void patchPeriod({ periodId: e.target.value || null })}
              aria-label="Período de servicio"
              className={`h-7 max-w-[150px] rounded-md border bg-white px-1.5 text-xs ${item.periodId ? "border-border text-ink-primary" : "border-dashed border-amber-400 text-amber-800"}`}
            >
              <option value="">Sin asignar</option>
              {periods.map((p) => <option key={p.id} value={p.id}>Mes {p.number} · {p.label}</option>)}
            </select>
          ) : (
            <span className="text-xs text-ink-secondary">{periods.find((p) => p.id === item.periodId) ? `Mes ${periods.find((p) => p.id === item.periodId)!.number}` : "—"}</span>
          )}
        </Td>
      )}
      {periods && (
        <Td>
          {clientId ? (
            <select
              value={item.goalValue ?? 1}
              onChange={(e) => void patchPeriod({ goalValue: Number(e.target.value) })}
              aria-label="Metas que cubre esta pauta"
              title="Metas que cubre esta pauta"
              className={`h-7 rounded-md border bg-white px-1 text-xs tabular ${(item.goalValue ?? 1) > 1 ? "border-violet-300 font-semibold text-violet-800" : "border-border text-ink-secondary"}`}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <span className="tabular text-xs text-ink-secondary">{item.goalValue ?? 1}</span>
          )}
        </Td>
      )}

      {clientId && (
        <Td align="right">
          <DropdownMenu>
            <DropdownMenuDots label="Acciones de la pauta" />
            <DropdownMenuContent>
              <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>Editar pauta</DropdownMenuItem>
              <DropdownMenuItem icon={<UserPlus />} onSelect={() => setEditing(true)}>{item.runner ? "Cambiar runner" : "Asignar runner"}</DropdownMenuItem>
              {periods && item.isProposal && (
                <DropdownMenuItem icon={<Check />} onSelect={() => void patchPeriod({ isProposal: false })}>Confirmar: ya es una oportunidad cerrada</DropdownMenuItem>
              )}
              {periods && item.needsReview && !item.isProposal && item.periodId && (
                <DropdownMenuItem icon={<Check />} onSelect={() => void patchPeriod({ periodId: item.periodId })}>Confirmar este período</DropdownMenuItem>
              )}
              {periods && (
                <DropdownMenuItem icon={<Layers />} onSelect={() => setCovers(true)}>
                  {item.coversPeriod ? "Quitar «cubre el período»" : "Marcar: cubre el período completo"}
                </DropdownMenuItem>
              )}
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
          <Modal open={covers} onOpenChange={setCovers} title={item.coversPeriod ? "Quitar la excepción" : "Esta actividad cubre el período completo"} description={item.eventName ?? undefined}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await patchPeriod({ coversPeriod: !item.coversPeriod, periodNote: item.coversPeriod ? null : coverNote.trim() || null });
                setCovers(false);
              }}
              className="space-y-4"
            >
              {!item.coversPeriod ? (
                <>
                  <p className="text-sm text-ink-secondary">Por acuerdo con el cliente, esta sola actividad vale por todas las metas del período. Explica el acuerdo: la nota queda en el registro.</p>
                  <FormGroup label="Nota del acuerdo" htmlFor={`cover-${item.id}`}>
                    <Textarea id={`cover-${item.id}`} rows={3} required value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="Ej.: Netflix Berlín cubrió el mes completo según lo acordado con el cliente" />
                  </FormGroup>
                </>
              ) : (
                <p className="text-sm text-ink-secondary">La actividad volverá a contar como una sola meta.</p>
              )}
              <FormActions>
                <Button type="button" variant="secondary" onClick={() => setCovers(false)}>Cancelar</Button>
                <Button type="submit">{item.coversPeriod ? "Quitar" : "Guardar excepción"}</Button>
              </FormActions>
            </form>
          </Modal>
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
