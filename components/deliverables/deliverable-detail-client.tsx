"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatDate, DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_COLORS, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { ArrowLeft, UserPlus, MapPin, Clock, Check, MessageSquare } from "lucide-react";

type RunnerAssignment = {
  id: string;
  eventName: string;
  eventDate: string | Date;
  arrivalTime: string | Date | null;
  eventTime: string | Date | null;
  venueName: string | null;
  venueAddress: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  runner: { id: string; name: string } | null;
};

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
  runnerAssignment: RunnerAssignment | null;
};

const STATUSES = ["IDEA", "OUTREACH", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

interface Props {
  deliverable: Deliverable;
  teamMembers: { id: string; name: string }[];
  runners: { id: string; name: string }[];
}

export function DeliverableDetailClient({ deliverable, teamMembers, runners }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAssignRunner, setShowAssignRunner] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

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

  async function addComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const content = form.get("content") as string;
    if (!content.trim()) return;

    await fetch(`/api/deliverables/${deliverable.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    setShowAddNote(false);
    router.refresh();
  }

  const colors = DELIVERABLE_STATUS_COLORS[deliverable.status as keyof typeof DELIVERABLE_STATUS_COLORS];
  const isConfirmedOrLater = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(deliverable.status);
  const needsRunner = isConfirmedOrLater && !deliverable.runnerAssignment;

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

      {/* Runner Assignment Banner */}
      {needsRunner && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Runner Needed</p>
                <p className="text-xs text-amber-700">This deliverable is confirmed. Assign a runner to handle it.</p>
              </div>
            </div>
            <Button onClick={() => setShowAssignRunner(true)} size="sm">
              Assign Runner
            </Button>
          </div>
        </div>
      )}

      {/* Runner Assignment Details */}
      {deliverable.runnerAssignment && (
        <div className="rounded-lg border border-border bg-white p-5 mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">Runner Assignment</h3>
          <div className="flex items-start justify-between">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-ink-muted" />
                <span className="font-medium text-ink-primary">{deliverable.runnerAssignment.runner?.name || "Unassigned"}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-2xs font-medium",
                  deliverable.runnerAssignment.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                  deliverable.runnerAssignment.status === "CONFIRMED" ? "bg-blue-50 text-blue-700" :
                  "bg-surface-2 text-ink-secondary"
                )}>
                  {deliverable.runnerAssignment.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-ink-secondary">
                <Clock className="h-3.5 w-3.5 text-ink-muted" />
                {formatDate(deliverable.runnerAssignment.eventDate)}
                {deliverable.runnerAssignment.eventTime && (
                  <span>at {new Date(deliverable.runnerAssignment.eventTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                )}
              </div>
              {deliverable.runnerAssignment.venueName && (
                <div className="flex items-center gap-2 text-ink-secondary">
                  <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                  {deliverable.runnerAssignment.venueName}
                  {deliverable.runnerAssignment.venueAddress && (
                    <span className="text-ink-muted">— {deliverable.runnerAssignment.venueAddress}</span>
                  )}
                </div>
              )}
              {deliverable.runnerAssignment.notes && (
                <p className="text-xs text-ink-muted mt-1">{deliverable.runnerAssignment.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

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
          <FormGroup label="Strategist" htmlFor="d-assignee">
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

      {/* Post-Event Notes / Comments */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Notes & Feedback ({deliverable.comments.length})
          </h2>
          <button
            onClick={() => setShowAddNote(true)}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary transition-colors"
          >
            <MessageSquare className="h-3 w-3" /> Add Note
          </button>
        </div>
        {deliverable.comments.length > 0 ? (
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
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-xs text-ink-muted">No notes yet. Add feedback after the event.</p>
          </div>
        )}
      </section>

      {/* Assign Runner Modal */}
      <AssignRunnerModal
        open={showAssignRunner}
        onOpenChange={setShowAssignRunner}
        deliverable={deliverable}
        runners={runners}
      />

      {/* Add Note Modal */}
      {showAddNote && (
        <Modal open={showAddNote} onOpenChange={setShowAddNote} title="Add Note" description="Post-event feedback or notes">
          <form onSubmit={addComment} className="space-y-4">
            <FormGroup label="Note" htmlFor="note-content" required>
              <Textarea id="note-content" name="content" rows={4} placeholder="Any feedback, issues, or wins..." required autoFocus />
            </FormGroup>
            <div className="flex gap-3">
              <Button type="submit">Add Note</Button>
              <Button type="button" variant="secondary" onClick={() => setShowAddNote(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AssignRunnerModal({
  open,
  onOpenChange,
  deliverable,
  runners,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deliverable: Deliverable;
  runners: { id: string; name: string }[];
}) {
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
      eventName: deliverable.title,
      eventDate,
      clientId: deliverable.clientId,
      deliverableId: deliverable.id,
      arrivalTime: (form.get("arrivalTime") as string) ? `${eventDate}T${form.get("arrivalTime")}:00` : undefined,
      eventTime: (form.get("eventTime") as string) ? `${eventDate}T${form.get("eventTime")}:00` : undefined,
      venueName: (form.get("venueName") as string) || undefined,
      venueAddress: (form.get("venueAddress") as string) || undefined,
      location: (form.get("location") as string) || undefined,
      itemType: DELIVERABLE_TYPE_LABELS[deliverable.type as keyof typeof DELIVERABLE_TYPE_LABELS] || deliverable.type,
      notes: (form.get("notes") as string) || undefined,
    };

    const res = await fetch(`/api/clients/${deliverable.clientId}/agenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to assign runner");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Assign Runner" description={`${deliverable.title} — ${deliverable.client.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Runner" htmlFor="ar-runner" required>
          <Select id="ar-runner" name="runnerId" required>
            <option value="">Select runner...</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Event Date" htmlFor="ar-date" required>
          <Input id="ar-date" name="eventDate" type="date" required defaultValue={deliverable.dueDate ? new Date(deliverable.dueDate).toISOString().split("T")[0] : ""} />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Arrival Time" htmlFor="ar-arrival">
            <Input id="ar-arrival" name="arrivalTime" type="time" />
          </FormGroup>
          <FormGroup label="Event Time (On Air)" htmlFor="ar-event">
            <Input id="ar-event" name="eventTime" type="time" />
          </FormGroup>
        </div>

        <FormGroup label="Venue Name" htmlFor="ar-venue">
          <Input id="ar-venue" name="venueName" placeholder="e.g., Telemundo Center" />
        </FormGroup>

        <FormGroup label="Venue Address" htmlFor="ar-address">
          <Input id="ar-address" name="venueAddress" placeholder="Full address..." />
        </FormGroup>

        <FormGroup label="City / Location" htmlFor="ar-location">
          <Input id="ar-location" name="location" placeholder="e.g., Miami, FL" />
        </FormGroup>

        <FormGroup label="Notes for Runner" htmlFor="ar-notes">
          <Textarea id="ar-notes" name="notes" rows={2} placeholder="Logistics details..." />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Assigning..." : "Assign Runner"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
