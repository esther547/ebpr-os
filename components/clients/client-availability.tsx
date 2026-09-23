"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, FormActions, FormGroup, Input, Select, Textarea } from "@/components/ui/form-field";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuDots, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import {
  formatRangeShort,
  type AvailabilityKindValue,
  type AvailabilityWindow,
} from "@/lib/client-availability-format";

/**
 * "Disponibilidad y viajes": dates the client is off (nothing gets booked) or
 * travelling (look for opportunities where they will be). `todayKey` is the Miami
 * day computed on the server so server and browser agree on "current" vs "past".
 */
export function ClientAvailability({
  clientId,
  windows,
  todayKey,
}: {
  clientId: string;
  windows: AvailabilityWindow[];
  todayKey: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AvailabilityWindow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AvailabilityWindow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const upcoming = windows
    .filter((w) => w.endKey >= todayKey)
    .sort((a, b) => a.startKey.localeCompare(b.startKey));
  const past = windows
    .filter((w) => w.endKey < todayKey)
    .sort((a, b) => b.startKey.localeCompare(a.startKey));

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/availability/${deleting.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: apiErrorMessage(data, "No se pudo eliminar"), variant: "error" });
        return;
      }
      toast({ title: "Fechas eliminadas", variant: "success" });
      setDeleting(null);
      router.refresh();
    } catch {
      toast({ title: "Error de red", description: "No se pudo contactar al servidor", variant: "error" });
    } finally {
      setDeleteLoading(false);
    }
  }

  const renderRow = (w: AvailabilityWindow, muted = false) => {
    const isNow = w.startKey <= todayKey && todayKey <= w.endKey;
    return (
      <li
        key={w.id}
        className={`flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 sm:px-4 ${muted ? "opacity-70" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {w.kind === "OFF" ? (
              <Badge tone="danger" dot>Off</Badge>
            ) : (
              <Badge tone="info" dot>Viaje</Badge>
            )}
            {w.kind === "TRAVEL" && w.location && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-ink-primary">
                <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                {w.location}
              </span>
            )}
            <span className="tabular text-sm text-ink-secondary">
              {formatRangeShort(w.startKey, w.endKey, w.startKey.slice(0, 4) !== todayKey.slice(0, 4))}
            </span>
            {isNow && <Badge tone="dark" size="xs">Ahora</Badge>}
          </div>
          {w.kind === "OFF" && w.location && (
            <p className="mt-1 text-xs text-ink-muted">{w.location}</p>
          )}
          {w.notes && <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">{w.notes}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuDots label="Acciones" className="-my-1 -mr-1 shrink-0" />
          <DropdownMenuContent>
            <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(w)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setDeleting(w)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  };

  return (
    <Card padding="lg" id="disponibilidad" className="scroll-mt-24">
      <CardHeader
        title="Disponibilidad y viajes"
        description="Off: no se agenda nada · Viaje: buscar oportunidades allí"
        actions={
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Agregar
          </Button>
        }
      />

      {upcoming.length > 0 ? (
        <ul className="space-y-2">{upcoming.map((w) => renderRow(w))}</ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Sin fechas próximas. Registra días off o viajes para no agendar en vano.
        </p>
      )}

      {past.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink-primary"
            aria-expanded={showPast}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPast ? "rotate-180" : ""}`} />
            {showPast ? "Ocultar anteriores" : `Ver anteriores (${past.length})`}
          </button>
          {showPast && <ul className="mt-2 space-y-2">{past.map((w) => renderRow(w, true))}</ul>}
        </div>
      )}

      <AvailabilityModal
        open={adding || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        clientId={clientId}
        window={editing}
        todayKey={todayKey}
      />

      <ConfirmModal
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar fechas"
        description={
          deleting
            ? `${deleting.kind === "OFF" ? "Off" : `Viaje${deleting.location ? ` a ${deleting.location}` : ""}`} · ${formatRangeShort(deleting.startKey, deleting.endKey, true)}. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

function AvailabilityModal({
  open,
  onOpenChange,
  clientId,
  window: existing,
  todayKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  window: AvailabilityWindow | null;
  todayKey: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  // Remount the form per window so defaults reset between add/edit.
  const formKey = existing?.id ?? "new";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Editar fechas" : "Agregar fechas"}
      description="Off: el cliente no está disponible. Viaje: disponible, pero en otro lugar."
    >
      <AvailabilityForm
        key={`${formKey}-${open}`}
        existing={existing}
        todayKey={todayKey}
        saving={saving}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (body) => {
          setSaving(true);
          try {
            const res = await fetch(
              existing
                ? `/api/clients/${clientId}/availability/${existing.id}`
                : `/api/clients/${clientId}/availability`,
              {
                method: existing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              toast({ title: apiErrorMessage(data, "No se pudo guardar"), variant: "error" });
              return;
            }
            toast({ title: existing ? "Fechas actualizadas" : "Fechas agregadas", variant: "success" });
            onOpenChange(false);
            router.refresh();
          } catch {
            toast({ title: "Error de red", description: "No se pudo contactar al servidor", variant: "error" });
          } finally {
            setSaving(false);
          }
        }}
      />
    </Modal>
  );
}

function AvailabilityForm({
  existing,
  todayKey,
  saving,
  onCancel,
  onSubmit,
}: {
  existing: AvailabilityWindow | null;
  todayKey: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: {
    kind: AvailabilityKindValue;
    startDate: string;
    endDate: string;
    location: string | null;
    notes: string | null;
  }) => void | Promise<void>;
}) {
  const [kind, setKind] = useState<AvailabilityKindValue>(existing?.kind ?? "OFF");
  const [startDate, setStartDate] = useState(existing?.startKey ?? todayKey);
  const [endDate, setEndDate] = useState(existing?.endKey ?? todayKey);
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (endDate < startDate) {
      setError("La fecha final debe ser igual o posterior a la inicial");
      return;
    }
    if (kind === "TRAVEL" && !location.trim()) {
      setError("Indica el lugar del viaje");
      return;
    }
    setError(null);
    void onSubmit({
      kind,
      startDate,
      endDate,
      location: location.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormGroup label="Tipo" htmlFor="avail-kind" required>
        <Select
          id="avail-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AvailabilityKindValue)}
        >
          <option value="OFF">Off: no disponible</option>
          <option value="TRAVEL">Viaje: disponible en otro lugar</option>
        </Select>
      </FormGroup>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormGroup label="Desde" htmlFor="avail-start" required>
          <Input
            id="avail-start"
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate < e.target.value) setEndDate(e.target.value);
            }}
          />
        </FormGroup>
        <FormGroup label="Hasta (incluido)" htmlFor="avail-end" required>
          <Input
            id="avail-end"
            type="date"
            required
            min={startDate}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </FormGroup>
      </div>
      <FormGroup
        label="Lugar"
        htmlFor="avail-location"
        required={kind === "TRAVEL"}
        description={kind === "TRAVEL" ? "Buscaremos oportunidades solo allí durante esas fechas." : undefined}
      >
        <Input
          id="avail-location"
          placeholder={kind === "TRAVEL" ? "p. ej., Bogotá o Madrid, España" : "Opcional"}
          required={kind === "TRAVEL"}
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </FormGroup>
      <FormGroup label={kind === "OFF" ? "Motivo / notas" : "Notas"} htmlFor="avail-notes">
        <Textarea
          id="avail-notes"
          rows={3}
          maxLength={1000}
          placeholder={kind === "OFF" ? "p. ej., vacaciones, grabación" : "p. ej., gira de prensa, hotel"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormGroup>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? "Guardar" : "Agregar"}
        </Button>
      </FormActions>
    </form>
  );
}
