"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatDate, DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_COLORS, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";
import { ArrowLeft } from "lucide-react";

type Deliverable = {
  id: string;
  title: string;
  type: string;
  status: string;
  notes: string | null;
  outcome: string | null;
  dueDate: string | Date | null;
  completedAt: string | Date | null;
  month: number;
  year: number;
  isClientVisible: boolean;
  clientId: string;
  client: { id: string; name: string };
  assignee: { id: string; name: string; avatar: string | null } | null;
  campaign: { id: string; name: string } | null;
  comments: { id: string; content: string; createdAt: string | Date; user: { name: string } }[];
};

const STATUSES = ["IDEA", "OUTREACH", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

interface Props {
  deliverable: Deliverable;
  teamMembers: { id: string; name: string }[];
}

export function DeliverableDetailClient({ deliverable, teamMembers }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const body = {
      title: form.get("title") as string,
      type: form.get("type") as string,
      status: form.get("status") as string,
      assigneeId: (form.get("assigneeId") as string) || null,
      notes: (form.get("notes") as string) || null,
      outcome: (form.get("outcome") as string) || null,
      dueDate: (form.get("dueDate") as string) || null,
      isClientVisible: form.get("isClientVisible") === "true",
    };

    const res = await fetch(`/api/deliverables/${deliverable.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Failed to update");
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    router.refresh();
  }

  async function quickStatus(status: string) {
    await fetch(`/api/deliverables/${deliverable.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  const colors = DELIVERABLE_STATUS_COLORS[deliverable.status as keyof typeof DELIVERABLE_STATUS_COLORS];

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/clients/${deliverable.clientId}/deliverables`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-primary transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Deliverables
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink-primary">{deliverable.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-ink-muted">{deliverable.client.name}</span>
            <span className="text-ink-muted">·</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", colors?.bg, colors?.text)}>
              {DELIVERABLE_STATUS_LABELS[deliverable.status as keyof typeof DELIVERABLE_STATUS_LABELS] || deliverable.status}
            </span>
            <span className="text-ink-muted">·</span>
            <span className="text-sm text-ink-muted">
              {DELIVERABLE_TYPE_LABELS[deliverable.type as keyof typeof DELIVERABLE_TYPE_LABELS] || deliverable.type}
            </span>
          </div>
        </div>
      </div>

      {/* Quick status buttons */}
      <div className="flex gap-2 mb-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => quickStatus(s)}
            disabled={s === deliverable.status}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              s === deliverable.status
                ? "bg-ink-primary text-ink-inverted"
                : "border border-border text-ink-secondary hover:bg-surface-2"
            )}
          >
            {DELIVERABLE_STATUS_LABELS[s as keyof typeof DELIVERABLE_STATUS_LABELS] || s}
          </button>
        ))}
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-white p-6 space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">Saved!</div>}

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Title" htmlFor="d-title" required>
            <Input id="d-title" name="title" defaultValue={deliverable.title} required />
          </FormGroup>
          <FormGroup label="Type" htmlFor="d-type" required>
            <Select id="d-type" name="type" defaultValue={deliverable.type} required>
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
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormGroup label="Status" htmlFor="d-status">
            <Select id="d-status" name="status" defaultValue={deliverable.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DELIVERABLE_STATUS_LABELS[s as keyof typeof DELIVERABLE_STATUS_LABELS] || s}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Assigned To" htmlFor="d-assignee">
            <Select id="d-assignee" name="assigneeId" defaultValue={deliverable.assignee?.id || ""}>
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Due Date" htmlFor="d-due">
            <Input id="d-due" name="dueDate" type="date" defaultValue={deliverable.dueDate ? new Date(deliverable.dueDate).toISOString().split("T")[0] : ""} />
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="d-notes">
          <Textarea id="d-notes" name="notes" rows={3} defaultValue={deliverable.notes || ""} placeholder="Internal notes..." />
        </FormGroup>

        <FormGroup label="Outcome / Win" htmlFor="d-outcome">
          <Textarea id="d-outcome" name="outcome" rows={2} defaultValue={deliverable.outcome || ""} placeholder="What was the result? (shown to client)" />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Client Visible" htmlFor="d-visible">
            <Select id="d-visible" name="isClientVisible" defaultValue={deliverable.isClientVisible ? "true" : "false"}>
              <option value="true">Yes — visible to client</option>
              <option value="false">No — internal only</option>
            </Select>
          </FormGroup>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Comments */}
      {deliverable.comments.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Comments ({deliverable.comments.length})
          </h2>
          <div className="space-y-3">
            {deliverable.comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-ink-primary">{c.user.name}</span>
                  <span className="text-xs text-ink-muted">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-ink-secondary">{c.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
