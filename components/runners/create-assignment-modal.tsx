"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed client (e.g. when opened from a client's agenda page). */
  clientId?: string;
  /** Selectable clients (e.g. when opened from the runner schedule). */
  clients?: { id: string; name: string }[];
  runners: { id: string; name: string }[];
}

/**
 * Build an absolute instant from a date + "HH:mm" typed in the browser.
 * The browser's timezone is the user's timezone, so the resulting ISO string
 * is correct regardless of the server's timezone (UTC on Vercel).
 */
function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function CreateAssignmentModal({ open, onOpenChange, clientId, clients = [], runners }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const targetClientId = clientId ?? ((form.get("clientId") as string) || "");
    if (!targetClientId) {
      toast({ title: "Please select a client", variant: "error" });
      setLoading(false);
      return;
    }

    const eventDate = form.get("eventDate") as string;
    const arrival = (form.get("arrivalTime") as string) || "";
    const onAir = (form.get("eventTime") as string) || "";
    // The assignment's date/time is the on-air time, else arrival, else midday.
    const eventInstant = localToIso(eventDate, onAir || arrival || "12:00");

    const body = {
      runnerId: form.get("runnerId") as string,
      eventName: ((form.get("eventName") as string) || "").trim() || undefined,
      eventDate: eventInstant,
      arrivalTime: arrival ? localToIso(eventDate, arrival) : undefined,
      eventTime: onAir ? localToIso(eventDate, onAir) : undefined,
      venueName: (form.get("venueName") as string) || undefined,
      venueAddress: (form.get("venueAddress") as string) || undefined,
      location: (form.get("location") as string) || undefined,
      itemType: (form.get("itemType") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch(`/api/clients/${targetClientId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error;
        toast({
          title: typeof msg === "string" ? msg : "Failed to create assignment",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      router.refresh();
      if (data?.conflictWarning) {
        toast({ title: "Scheduling conflict", description: String(data.conflictWarning) });
      } else {
        toast({ title: "Assignment scheduled", variant: "success" });
      }
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New Runner Assignment"
      description="Schedule a runner for an event or appearance"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!clientId && (
          <FormGroup label="Client" htmlFor="ra-client" required>
            <Select id="ra-client" name="clientId" required>
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormGroup>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Runner" htmlFor="ra-runner" required>
            <Select id="ra-runner" name="runnerId" required>
              <option value="">Select runner...</option>
              {runners.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Event Type" htmlFor="ra-type">
            <Select id="ra-type" name="itemType">
              <option value="">Select type...</option>
              <option value="TV Appearance">TV Appearance</option>
              <option value="Podcast">Podcast</option>
              <option value="Red Carpet">Red Carpet</option>
              <option value="Event">Event</option>
              <option value="Photo Shoot">Photo Shoot</option>
              <option value="Press Junket">Press Junket</option>
              <option value="Meet & Greet">Meet & Greet</option>
              <option value="Other">Other</option>
            </Select>
          </FormGroup>
        </div>

        <FormGroup label="Event Name" htmlFor="ra-name" required>
          <Input id="ra-name" name="eventName" required placeholder="e.g., TELEMUNDO — Hoy Día" />
        </FormGroup>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Event Date" htmlFor="ra-date" required>
            <Input id="ra-date" name="eventDate" type="date" required />
          </FormGroup>
          <FormGroup label="Arrival Time" htmlFor="ra-arrival">
            <Input id="ra-arrival" name="arrivalTime" type="time" />
          </FormGroup>
          <FormGroup label="Event Time (On Air)" htmlFor="ra-event">
            <Input id="ra-event" name="eventTime" type="time" />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Venue Name" htmlFor="ra-venue">
            <Input id="ra-venue" name="venueName" placeholder="e.g., Telemundo Center" />
          </FormGroup>
          <FormGroup label="City / Location" htmlFor="ra-location">
            <Input id="ra-location" name="location" placeholder="e.g., Miami, FL" />
          </FormGroup>
        </div>

        <FormGroup label="Venue Address" htmlFor="ra-address">
          <Input id="ra-address" name="venueAddress" placeholder="Full address..." />
        </FormGroup>

        <FormGroup label="Notes" htmlFor="ra-notes">
          <Textarea id="ra-notes" name="notes" rows={2} placeholder="Logistics details..." />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Schedule Assignment
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
