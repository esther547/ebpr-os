"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";

export type EditableAgendaItem = {
  id: string;
  eventName?: string | null;
  eventDate: Date | string;
  arrivalTime: Date | string | null;
  eventTime: Date | string | null;
  venueName: string | null;
  venueAddress: string | null;
  itemType: string | null;
  status: string;
  notes: string | null;
  runner: { id: string; name: string } | null;
};

type Companion = { id: string; name: string; role?: string };

function localDate(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function localTime(d: Date | string | null) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
/** Combine a calendar date and HH:mm in the browser's timezone into an ISO instant. */
function toInstant(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "12:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export function EditAgendaItemModal({
  open,
  onOpenChange,
  clientId,
  item,
  runners,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  item: EditableAgendaItem;
  runners: Companion[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const onlyRunners = runners.filter((r) => !r.role || r.role === "RUNNER");
  const team = runners.filter((r) => r.role && r.role !== "RUNNER");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const date = f.get("date") as string;
    const time = (f.get("time") as string) || "";
    const arrival = (f.get("arrival") as string) || "";
    const runnerId = (f.get("runnerId") as string) || "";
    const body: Record<string, unknown> = {
      eventName: ((f.get("eventName") as string) || "").trim(),
      eventDate: toInstant(date, time),
      eventTime: time ? toInstant(date, time) : null,
      arrivalTime: arrival ? toInstant(date, arrival) : null,
      venueName: ((f.get("venueName") as string) || "").trim(),
      venueAddress: ((f.get("venueAddress") as string) || "").trim(),
      itemType: ((f.get("itemType") as string) || "").trim(),
      notes: ((f.get("notes") as string) || "").trim(),
      status: f.get("status") as string,
    };
    // Only send runnerId when the user changed it, so an unchanged auto-assignment stays automatic.
    if (runnerId !== (item.runner?.id ?? "")) body.runnerId = runnerId || null;
    try {
      const res = await fetch(`/api/clients/${clientId}/agenda/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: apiErrorMessage(data, "No se pudo guardar la pauta"), variant: "error" });
        return;
      }
      toast({ title: "Pauta actualizada", variant: "success" });
      if (typeof data?.warning === "string") toast({ title: `Ojo: ${data.warning}`, variant: "default", duration: 10000 });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast({ title: "No se pudo guardar la pauta", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Editar pauta" description={item.eventName ?? undefined} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Pauta" htmlFor="ea-name" required>
          <Input id="ea-name" name="eventName" defaultValue={item.eventName ?? ""} required />
        </FormGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormGroup label="Fecha" htmlFor="ea-date" required>
            <Input id="ea-date" name="date" type="date" defaultValue={localDate(item.eventDate)} required />
          </FormGroup>
          <FormGroup label="Hora" htmlFor="ea-time">
            <Input id="ea-time" name="time" type="time" defaultValue={localTime(item.eventTime)} />
          </FormGroup>
          <FormGroup label="Llegada" htmlFor="ea-arrival">
            <Input id="ea-arrival" name="arrival" type="time" defaultValue={localTime(item.arrivalTime)} />
          </FormGroup>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Lugar" htmlFor="ea-venue">
            <Input id="ea-venue" name="venueName" defaultValue={item.venueName ?? ""} placeholder="Telemundo Center" />
          </FormGroup>
          <FormGroup label="Dirección" htmlFor="ea-address">
            <Input id="ea-address" name="venueAddress" defaultValue={item.venueAddress ?? ""} />
          </FormGroup>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormGroup label="Tipo" htmlFor="ea-type">
            <Input id="ea-type" name="itemType" defaultValue={item.itemType ?? ""} placeholder="TV / Podcast / Evento" />
          </FormGroup>
          <FormGroup label="Runner" htmlFor="ea-runner">
            <Select id="ea-runner" name="runnerId" defaultValue={item.runner?.id ?? ""}>
              <option value="">Sin asignar (se asigna automáticamente)</option>
              <optgroup label="Runners">
                {onlyRunners.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </optgroup>
              {team.length > 0 && (
                <optgroup label="Equipo (acompaña a veces)">
                  {team.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                </optgroup>
              )}
            </Select>
          </FormGroup>
          <FormGroup label="Estado" htmlFor="ea-status">
            <Select id="ea-status" name="status" defaultValue={item.status}>
              <option value="SCHEDULED">Programada</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="COMPLETED">Completada</option>
              <option value="CANCELLED">Cancelada</option>
            </Select>
          </FormGroup>
        </div>
        <FormGroup label="Notas" htmlFor="ea-notes">
          <Textarea id="ea-notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
