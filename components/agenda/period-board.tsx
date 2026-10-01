"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, CalendarDays, Layers, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { SectionHeader } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { AgendaMonthSection, type PeriodOption } from "./agenda-month-section";
import { MONTH_NAMES_ES } from "@/lib/agenda-months";

type AgendaItem = React.ComponentProps<typeof AgendaMonthSection>["items"][number];
type UnitState = "scheduled" | "closed_pending" | "executed" | "cancelled";
export type GoalOnlyUnit = { goalId: string; title: string; state: UnitState; coversPeriod: boolean; periodNote: string | null; periodId: string | null; closedAt: string | null; executedAt: string | null };
export type PeriodCard = PeriodOption & { refYear: number; refMonth: number; note: string | null; achieved: number; closedPending: number; executed: number; items: AgendaItem[]; goalOnly: GoalOnlyUnit[] };

const STATE: Record<UnitState, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Programada", tone: "neutral" },
  closed_pending: { label: "Cerrada · pendiente de ejecución", tone: "warning" },
  executed: { label: "Ejecutada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
};
const monthName = (m: number) => `${MONTH_NAMES_ES[m - 1].charAt(0)}${MONTH_NAMES_ES[m - 1].slice(1).toLowerCase()}`;

type Props = {
  clientId: string;
  canEdit: boolean;
  runners: { id: string; name: string; role?: string }[];
  periods: PeriodCard[];
  pending: { items: AgendaItem[]; goalOnly: GoalOnlyUnit[] };
  /** Every pauta, for the calendar view. */
  allItems: AgendaItem[];
  defaultTarget: number;
};

/** The client's agenda by service period: what each paid period holds, what is closed, what is executed. */
export function PeriodBoard({ clientId, canEdit, runners, periods, pending, allItems, defaultTarget }: Props) {
  const [view, setView] = useState<"periods" | "calendar">("periods");
  const [editing, setEditing] = useState<PeriodCard | "new" | null>(null);
  const options: PeriodOption[] = periods.map((p) => ({ id: p.id, number: p.number, label: p.label, target: p.target }));
  const pendingCount = pending.items.length + pending.goalOnly.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
          <button type="button" onClick={() => setView("periods")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === "periods" ? "bg-ink-primary text-white" : "text-ink-secondary"}`}>Por período</button>
          <button type="button" onClick={() => setView("calendar")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === "calendar" ? "bg-ink-primary text-white" : "text-ink-secondary"}`}>Por fecha</button>
        </div>
        {canEdit && view === "periods" && (
          <Button variant="secondary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
            Agregar período
          </Button>
        )}
      </div>

      {view === "calendar" ? (
        <CalendarView items={allItems} clientId={clientId} canEdit={canEdit} runners={runners} periods={options} />
      ) : (
        <>
          {pendingCount > 0 && (
            <Card padding="none" className="border-amber-300 bg-amber-50/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h3 className="text-sm font-semibold text-amber-900">Pendientes de asignar a un período ({pendingCount})</h3>
              </div>
              <p className="mb-3 text-xs text-amber-900/80">No hay evidencia suficiente de a qué período pertenecen. Elige el período en cada fila.</p>
              {pending.items.length > 0 && <AgendaMonthSection monthNumber={0} hideHeader items={pending.items} runners={runners} clientId={clientId} canEdit={canEdit} periods={options} />}
              {pending.goalOnly.length > 0 && <GoalOnlyList units={pending.goalOnly} periods={options} canEdit={canEdit} />}
            </Card>
          )}

          {periods.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Sin períodos de servicio" description={canEdit ? "Agrega el Mes 1 del cliente con las metas acordadas." : "Todavía no hay períodos."} />
          ) : (
            periods.map((p) => {
              const pct = p.target > 0 ? Math.min(100, Math.round((p.achieved / p.target) * 100)) : 0;
              const done = p.target > 0 && p.achieved >= p.target;
              return (
                <Card key={p.id} padding="none" className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-ink-primary">Mes {p.number} · {p.label}</h3>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {p.target > 0 ? `${p.target} metas acordadas` : "Sin meta fija"}
                        {p.closedPending > 0 && ` · ${p.closedPending} cerrada${p.closedPending === 1 ? "" : "s"} pendiente${p.closedPending === 1 ? "" : "s"} de ejecución`}
                        {p.executed > 0 && ` · ${p.executed} ejecutada${p.executed === 1 ? "" : "s"}`}
                      </p>
                      {p.note && <p className="mt-1 text-xs text-ink-secondary">{p.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`tabular text-lg font-semibold ${done ? "text-emerald-700" : "text-ink-primary"}`}>{p.achieved}{p.target > 0 ? ` / ${p.target}` : ""}</p>
                        {p.target > 0 && (
                          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                            <div className={`h-full ${done ? "bg-emerald-500" : "bg-ink-primary"}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar Mes ${p.number}`} onClick={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {p.items.length === 0 && p.goalOnly.length === 0 ? (
                    <p className="text-xs text-ink-muted">Sin metas todavía.</p>
                  ) : (
                    <>
                      {p.items.length > 0 && <AgendaMonthSection monthNumber={p.number} hideHeader items={p.items} runners={runners} clientId={clientId} canEdit={canEdit} periods={options} />}
                      {p.goalOnly.length > 0 && <GoalOnlyList units={p.goalOnly} periods={options} canEdit={canEdit} />}
                    </>
                  )}
                </Card>
              );
            })
          )}
        </>
      )}

      {editing && (
        <PeriodModal
          clientId={clientId}
          period={editing === "new" ? null : editing}
          nextNumber={(periods[periods.length - 1]?.number ?? 0) + 1}
          defaultTarget={defaultTarget}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Closed goals that have no pauta (an interview, a publication…): same states, same period selector. */
function GoalOnlyList({ units, periods, canEdit }: { units: GoalOnlyUnit[]; periods: PeriodOption[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  async function patch(goalId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/deliverables/${goalId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo guardar"), variant: "error" }); return; }
    router.refresh();
  }
  return (
    <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border">
      {units.map((u) => (
        <li key={u.goalId} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink-primary">{u.title}</p>
            <p className="text-2xs text-ink-muted">Meta sin pauta{u.closedAt ? ` · cerrada ${new Date(u.closedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}` : ""}{u.executedAt ? ` · ejecutada ${new Date(u.executedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}` : ""}</p>
          </div>
          <Badge size="xs" tone={STATE[u.state].tone} dot>{STATE[u.state].label}</Badge>
          {u.coversPeriod && <span title={u.periodNote ?? undefined}><Badge size="xs" tone="purple">Cubre el período</Badge></span>}
          {canEdit ? (
            <select value={u.periodId ?? ""} onChange={(e) => void patch(u.goalId, { periodId: e.target.value || null })} aria-label="Período" className={`h-7 rounded-md border bg-white px-1.5 text-xs ${u.periodId ? "border-border" : "border-dashed border-amber-400 text-amber-800"}`}>
              <option value="">Sin asignar</option>
              {periods.map((p) => <option key={p.id} value={p.id}>Mes {p.number} · {p.label}</option>)}
            </select>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CalendarView({ items, clientId, canEdit, runners, periods }: { items: AgendaItem[]; clientId: string; canEdit: boolean; runners: Props["runners"]; periods: PeriodOption[] }) {
  const groups = new Map<string, AgendaItem[]>();
  for (const it of [...items].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())) {
    const d = new Date(it.eventDate);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  if (!groups.size) return <EmptyState icon={<CalendarDays />} title="Sin pautas" />;
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([k, list]) => {
        const [y, m] = k.split("-").map(Number);
        return <AgendaMonthSection key={k} monthNumber={0} title={`${monthName(m)} ${y}`} description="Fechas reales de los eventos" actions={<span className="text-xs text-ink-muted">{list.length} pautas</span>} items={list} runners={runners} clientId={clientId} canEdit={canEdit} periods={periods} />;
      })}
    </div>
  );
}

function PeriodModal({ clientId, period, nextNumber, defaultTarget, onClose }: { clientId: string; period: PeriodCard | null; nextNumber: number; defaultTarget: number; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = new Date();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { label: String(f.get("label") || "").trim() || undefined, refYear: Number(f.get("refYear")), refMonth: Number(f.get("refMonth")), target: Number(f.get("target")), note: String(f.get("note") || "").trim() || null };
    setSaving(true);
    try {
      const res = await fetch(period ? `/api/clients/${clientId}/periods/${period.id}` : `/api/clients/${clientId}/periods`, { method: period ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo guardar"), variant: "error" }); return; }
      router.refresh();
      onClose();
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!period) return;
    const res = await fetch(`/api/clients/${clientId}/periods/${period.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo borrar"), variant: "error" }); setConfirmDelete(false); return; }
    router.refresh();
    onClose();
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={period ? `Editar Mes ${period.number}` : `Agregar Mes ${nextNumber}`} description="Un período de servicio es lo que el cliente paga: su número, su mes de referencia y las metas acordadas.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Mes de referencia" htmlFor="pm-month">
            <Select id="pm-month" name="refMonth" defaultValue={period?.refMonth ?? now.getMonth() + 1}>
              {MONTH_NAMES_ES.map((n, i) => <option key={n} value={i + 1}>{monthName(i + 1)}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Año" htmlFor="pm-year"><Input id="pm-year" name="refYear" type="number" min={2020} max={2100} defaultValue={period?.refYear ?? now.getFullYear()} /></FormGroup>
        </div>
        <FormGroup label="Etiqueta (opcional)" htmlFor="pm-label" hint="Lo que ve el cliente, p. ej. «Septiembre 2026»"><Input id="pm-label" name="label" defaultValue={period?.label ?? ""} placeholder="Se arma sola con el mes y el año" /></FormGroup>
        <FormGroup label="Metas acordadas para este período" htmlFor="pm-target"><Input id="pm-target" name="target" type="number" min={0} max={100} required defaultValue={period?.target ?? defaultTarget} /></FormGroup>
        <FormGroup label="Nota" htmlFor="pm-note" hint="Opcional"><Textarea id="pm-note" name="note" rows={2} defaultValue={period?.note ?? ""} placeholder="Acuerdos especiales de este período" /></FormGroup>
        <FormActions>
          {period && <Button type="button" variant="ghost" className="mr-auto text-red-700" onClick={() => setConfirmDelete(true)}>Borrar período</Button>}
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving} leftIcon={<Layers className="h-4 w-4" />}>{period ? "Guardar" : "Crear período"}</Button>
        </FormActions>
      </form>
      <ConfirmModal open={confirmDelete} onOpenChange={setConfirmDelete} title="Borrar este período" description="Solo se puede borrar un período sin metas. Los siguientes se renumeran." confirmLabel="Borrar" destructive onConfirm={() => void remove()} />
    </Modal>
  );
}
