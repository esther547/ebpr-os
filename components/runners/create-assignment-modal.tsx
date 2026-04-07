"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  runners: { id: string; name: string }[];
}

export function CreateAssignmentModal({ open, onOpenChange, clientId, runners }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const eventDate = form.get("eventDate") as string;

    const body = {
      runnerId: form.get("runnerId") as string,
      date: eventDate,
      arrivalTime: (form.get("arrivalTime") as string) ? `${eventDate}T${form.get("arrivalTime")}:00` : undefined,
      eventTime: (form.get("eventTime") as string) ? `${eventDate}T${form.get("eventTime")}:00` : undefined,
      venueName: (form.get("venueName") as string) || undefined,
      venueAddress: (form.get("venueAddress") as string) || undefined,
      itemType: (form.get("itemType") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    const res = await fetch(`/api/clients/${clientId}/agenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create assignment");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Runner Assignment" description="Schedule a runner for an event or appearance">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <FormGroup label="Runner" htmlFor="ra-runner" required>
          <Select id="ra-runner" name="runnerId" required>
            <option value="">Select runner...</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Event Date" htmlFor="ra-date" required>
          <Input id="ra-date" name="eventDate" type="date" required />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Arrival Time" htmlFor="ra-arrival">
            <Input id="ra-arrival" name="arrivalTime" type="time" />
          </FormGroup>
          <FormGroup label="Event Time (On Air)" htmlFor="ra-event">
            <Input id="ra-event" name="eventTime" type="time" />
          </FormGroup>
        </div>

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

        <FormGroup label="Venue Name" htmlFor="ra-venue">
          <Input id="ra-venue" name="venueName" placeholder="e.g., Telemundo Center" />
        </FormGroup>

        <FormGroup label="Venue Address" htmlFor="ra-address">
          <Input id="ra-address" name="venueAddress" placeholder="Full address..." />
        </FormGroup>

        <FormGroup label="Notes" htmlFor="ra-notes">
          <Textarea id="ra-notes" name="notes" rows={2} placeholder="Logistics details..." />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Scheduling..." : "Schedule Assignment"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
