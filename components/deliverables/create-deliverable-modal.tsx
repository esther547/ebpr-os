"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  teamMembers: { id: string; name: string }[];
}

export function CreateDeliverableModal({ open, onOpenChange, clientId, teamMembers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const dueDate = (form.get("dueDate") as string) || undefined;

    // The deliverable counts toward the month it is due in; otherwise the current month.
    const now = new Date();
    const dueMatch = dueDate ? /^(\d{4})-(\d{2})-\d{2}$/.exec(dueDate) : null;
    const month = dueMatch ? parseInt(dueMatch[2], 10) : now.getMonth() + 1;
    const year = dueMatch ? parseInt(dueMatch[1], 10) : now.getFullYear();

    const body = {
      clientId,
      title: (form.get("title") as string).trim(),
      type: form.get("type") as string,
      assigneeId: (form.get("assigneeId") as string) || undefined,
      dueDate,
      notes: (form.get("notes") as string) || undefined,
      month,
      year,
    };

    try {
      const res = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed to create deliverable");
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Network error — could not reach the server");
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Deliverable" description="Add a new PR deliverable for this client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

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

        <FormGroup label="Assigned To" htmlFor="del-assignee">
          <Select id="del-assignee" name="assigneeId">
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Due Date" htmlFor="del-due">
          <Input id="del-due" name="dueDate" type="date" />
          <p className="mt-1 text-xs text-ink-muted">Counts toward the month it is due in (this month if left blank).</p>
        </FormGroup>

        <FormGroup label="Notes" htmlFor="del-notes">
          <Textarea id="del-notes" name="notes" rows={3} placeholder="Additional context..." />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Deliverable"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
