"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

const ITEM_TYPES = ["TV", "Podcast", "Red Carpet", "Event", "Interview", "Photoshoot", "Radio", "Digital", "Press", "Award Show"];

interface Props {
  clientId: string;
  clientStatus?: string;
  runners: { id: string; name: string; role?: string }[];
  deliverables: { id: string; title: string }[];
}

/** "+ Add Item" button for the agenda page, with its creation modal. */
export function AgendaAddItemButton({ clientId, clientStatus = "ACTIVE", runners, deliverables }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const paused = clientStatus === "PAUSED" || clientStatus === "CHURNED";

  function toInstant(date: string, time: FormDataEntryValue | null): string | undefined {
    if (!time || typeof time !== "string") return undefined;
    const d = new Date(`${date}T${time}`);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const eventDate = form.get("eventDate") as string;
    const monthRaw = (form.get("monthNumber") as string) || "";

    const body = {
      // Blank = the activity goes on the agenda needing a runner.
      runnerId: ((form.get("runnerId") as string) || "").trim() || null,
      deliverableId: (form.get("deliverableId") as string) || undefined,
      eventName: ((form.get("eventName") as string) || "").trim() || undefined,
      eventDate,
      arrivalTime: toInstant(eventDate, form.get("arrivalTime")),
      eventTime: toInstant(eventDate, form.get("eventTime")),
      itemType: (form.get("itemType") as string) || undefined,
      venueName: (form.get("venueName") as string) || undefined,
      venueAddress: (form.get("venueAddress") as string) || undefined,
      location: (form.get("location") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      accompanistCount: parseInt((form.get("accompanistCount") as string) || "0", 10) || 0,
      monthNumber: monthRaw ? parseInt(monthRaw, 10) : undefined,
      status: (form.get("status") as string) || "SCHEDULED",
    };

    try {
      const res = await fetch(`/api/clients/${clientId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Failed to add agenda item",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }
      setLoading(false);
      router.refresh();
      if (data.conflictWarning) {
        toast({
          title: "Scheduling conflict",
          description: `${data.conflictWarning}. The item was saved.`,
          variant: "error",
          duration: 10000,
        });
        return;
      }
      toast({ title: "Agenda item added", variant: "success" });
      setOpen(false);
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={paused}
        leftIcon={<Plus className="h-4 w-4" />}
        title={paused ? `Client is ${clientStatus.toLowerCase()} — reactivate it to schedule runners.` : undefined}
      >
        Add Item
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="Add Agenda Item" description="Schedule an appearance and assign a runner" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {runners.length === 0 && (
            <Card padding="sm" className="border-amber-200 bg-amber-50/60">
              <p className="text-sm text-amber-800">No active runners found. Add a runner in Settings first.</p>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormGroup label="Item / Appearance" htmlFor="ag-name" required>
              <Input id="ag-name" name="eventName" placeholder="e.g., Despierta América" required autoFocus />
            </FormGroup>
            <FormGroup label="Type" htmlFor="ag-type">
              <Select id="ag-type" name="itemType">
                <option value="">Select type...</option>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormGroup label="Date" htmlFor="ag-date" required>
              <Input id="ag-date" name="eventDate" type="date" required />
            </FormGroup>
            <FormGroup label="Arrival (Llegada)" htmlFor="ag-arrival">
              <Input id="ag-arrival" name="arrivalTime" type="time" />
            </FormGroup>
            <FormGroup label="On Air / Start" htmlFor="ag-time">
              <Input id="ag-time" name="eventTime" type="time" />
            </FormGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormGroup label="PR Runner" htmlFor="ag-runner" hint="optional">
              <Select id="ag-runner" name="runnerId">
                <option value="">Leave unassigned (needs a runner)</option>
                {(() => {
              const onlyRunners = runners.filter((r) => !r.role || r.role === "RUNNER");
              const team = runners.filter((r) => r.role && r.role !== "RUNNER");
              return (
                <>
                  <optgroup label="Runners">
                    {onlyRunners.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </optgroup>
                  {team.length > 0 && (
                    <optgroup label="Equipo (acompaña a veces)">
                      {team.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                    </optgroup>
                  )}
                </>
              );
            })()}
              </Select>
            </FormGroup>
            <FormGroup label="Linked Deliverable" htmlFor="ag-deliverable">
              <Select id="ag-deliverable" name="deliverableId">
                <option value="">None</option>
                {deliverables.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </Select>
            </FormGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormGroup label="Venue" htmlFor="ag-venue">
              <Input id="ag-venue" name="venueName" placeholder="e.g., Telemundo Center" />
            </FormGroup>
            <FormGroup label="Venue Address" htmlFor="ag-address">
              <Input id="ag-address" name="venueAddress" placeholder="Full address..." />
            </FormGroup>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormGroup label="City" htmlFor="ag-location">
              <Input id="ag-location" name="location" placeholder="Miami, FL" />
            </FormGroup>
            <FormGroup label="Accompanists" htmlFor="ag-acc">
              <Input id="ag-acc" name="accompanistCount" type="number" min={0} defaultValue={0} />
            </FormGroup>
            <FormGroup label="Month (MES #)" htmlFor="ag-month">
              <Input id="ag-month" name="monthNumber" type="number" min={1} max={24} placeholder="1" />
            </FormGroup>
            <FormGroup label="Status" htmlFor="ag-status">
              <Select id="ag-status" name="status" defaultValue="SCHEDULED">
                <option value="SCHEDULED">Goal</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </FormGroup>
          </div>

          <FormGroup label="Notes for Runner" htmlFor="ag-notes">
            <Textarea id="ag-notes" name="notes" rows={2} placeholder="Logistics details..." />
          </FormGroup>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={runners.length === 0}>
              Add Item
            </Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}
