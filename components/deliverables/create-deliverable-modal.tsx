"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { localDateInputValue } from "@/lib/form-helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  teamMembers: { id: string; name: string }[];
  currentUserId?: string;
  /** Report months the strategist can pick (server-computed for the client's cycle). */
  reportMonths?: { month: number; year: number; label: string }[];
}

export function CreateDeliverableModal({ open, onOpenChange, clientId, teamMembers, currentUserId, reportMonths = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const dueDate = (form.get("dueDate") as string) || undefined;
    const reportMonth = (form.get("reportMonth") as string) || "";
    const [rmYear, rmMonth] = reportMonth ? reportMonth.split("-").map(Number) : [undefined, undefined];

    const body = {
      month: rmMonth,
      year: rmYear,
      clientId,
      title: (form.get("title") as string).trim(),
      type: form.get("type") as string,
      assigneeId: (form.get("assigneeId") as string) || undefined,
      dueDate,
      notes: (form.get("notes") as string) || undefined,
      eventTime: (form.get("eventTime") as string) || null,
      venueName: (form.get("venueName") as string) || null,
      venueAddress: (form.get("venueAddress") as string) || null,
      needsRunner: form.get("needsRunner") === "on",
      closedById: (form.get("closedById") as string) || null,
      closedAt: (form.get("closedAt") as string) || null,
      status: form.get("confirmed") === "on" ? "CONFIRMED" : undefined,
    };

    try {
      const res = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Failed to create deliverable",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }

      const created = await res.json().catch(() => ({}));
      onOpenChange(false);
      setLoading(false);
      toast({ title: "Deliverable created", variant: "success" });
      if (typeof created.warning === "string") toast({ title: `Ojo: ${created.warning}`, variant: "default", duration: 10000 });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Deliverable" description="Add a new PR deliverable for this client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Title" htmlFor="del-title" required>
          <Input id="del-title" name="title" placeholder="e.g., Vogue Feature Pitch" required autoFocus />
        </FormGroup>

        <FormGroup label="Type" htmlFor="del-type" required>
          <Select id="del-type" name="type" required>
            <option value="">Select type...</option>
            <option value="PRESS_PLACEMENT">Press Placement</option>
            <option value="INTERVIEW">Interview</option>
            <option value="INFLUENCER_COLLAB">Influencer Collab</option>
            <option value="EVENT_APPEARANCE">Event Appearance</option>
            <option value="BRAND_OPPORTUNITY">Brand Opportunity</option>
            <option value="INTRODUCTION">Introduction</option>
            <option value="SOCIAL_MEDIA">Social Media</option>
            <option value="PRESS_RELEASE">Press Release</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormGroup>

        <div className="grid gap-4 sm:grid-cols-2 rounded-xl bg-accent2-soft/60 p-3">
          <FormGroup label="Cerrada por" htmlFor="del-closed-by" description="Estratega que logró esta meta. Cuenta en Metas por estratega desde hoy.">
            <Select id="del-closed-by" name="closedById" defaultValue={currentUserId ?? ""}>
              <option value="">Aún no está cerrada</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Fecha de cierre" htmlFor="del-closed-at">
            <Input id="del-closed-at" name="closedAt" type="date" defaultValue={localDateInputValue()} />
          </FormGroup>
        </div>

        <FormGroup label="Assigned To" htmlFor="del-assignee">
          <Select id="del-assignee" name="assigneeId" defaultValue={currentUserId ?? ""}>
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup
          label="Due Date"
          htmlFor="del-due"
          description="Counts toward the client's goal cycle it is due in (current cycle if left blank)."
        >
          <Input id="del-due" name="dueDate" type="date" />
        </FormGroup>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormGroup label="Hora" htmlFor="del-time" hint="pauta">
            <Input id="del-time" name="eventTime" type="time" />
          </FormGroup>
          <FormGroup label="Lugar" htmlFor="del-venue" className="sm:col-span-2">
            <Input id="del-venue" name="venueName" placeholder="Telemundo Center, Zoom, Casa D…" />
          </FormGroup>
        </div>
        <FormGroup label="Dirección" htmlFor="del-address">
          <Input id="del-address" name="venueAddress" placeholder="Opcional" />
        </FormGroup>
        <div className="flex flex-wrap gap-6 rounded-xl bg-surface-2 px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-ink-primary">
            <input type="checkbox" name="needsRunner" defaultChecked className="h-4 w-4 rounded border-border accent-accent2" />
            Requiere runner
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-primary">
            <input type="checkbox" name="confirmed" className="h-4 w-4 rounded border-border accent-accent2" />
            Ya está confirmada (crear pauta y asignar runner ahora)
          </label>
        </div>

        {reportMonths.length > 0 && (
          <FormGroup label="Mes del reporte" htmlFor="del-report-month" description="A qué mes de la cuota del cliente cuenta esta meta. Automático = el primer mes que aún tiene cupo, aunque la pauta salga después.">
            <Select id="del-report-month" name="reportMonth" defaultValue="">
              <option value="">Automático (primer mes con cupo)</option>
              {reportMonths.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.label}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}

        <FormGroup label="Notes" htmlFor="del-notes">
          <Textarea id="del-notes" name="notes" rows={3} placeholder="Additional context..." />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Deliverable
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
