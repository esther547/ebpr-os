"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuDots,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { UserPlus, MapPin, Clock, MessageSquare, Trash2 } from "lucide-react";

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
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showAssignRunner, setShowAssignRunner] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [notePosting, setNotePosting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

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

    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Failed to update",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setSaving(false);
        return;
      }

      setSaving(false);
      toast({ title: "Changes saved", variant: "success" });
      router.refresh();
      // Confirmed without a runner: open the assignment prompt right away.
      if (body.status === "CONFIRMED" && deliverable.status !== "CONFIRMED" && !deliverable.runnerAssignment) {
        setShowAssignRunner(true);
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setSaving(false);
    }
  }

  async function quickStatus(status: string) {
    setStatusBusy(status);
    try {
      // Dedicated status endpoint: logs the transition and notifies the team.
      const res = await fetch(`/api/deliverables/${deliverable.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not change status",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        return;
      }
      toast({
        title: `Moved to ${DELIVERABLE_STATUS_LABELS[status as keyof typeof DELIVERABLE_STATUS_LABELS] || status}`,
        variant: "success",
      });
      router.refresh();
      if (status === "CONFIRMED" && !deliverable.runnerAssignment) {
        setShowAssignRunner(true);
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
    } finally {
      setStatusBusy(null);
    }
  }

  async function addComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const content = form.get("content") as string;
    if (!content.trim()) return;
    setNotePosting(true);

    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not add note",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setNotePosting(false);
        return;
      }
      setShowAddNote(false);
      setNotePosting(false);
      toast({ title: "Note added", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setNotePosting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not delete deliverable",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setShowDelete(false);
        return;
      }
      router.push(`/clients/${deliverable.clientId}/deliverables`);
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setShowDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const isConfirmedOrLater = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(deliverable.status);
  const needsRunner = isConfirmedOrLater && !deliverable.runnerAssignment;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: deliverable.client.name, href: `/clients/${deliverable.clientId}` },
          { label: "Deliverables", href: `/clients/${deliverable.clientId}/deliverables` },
        ]}
        eyebrow={
          DELIVERABLE_TYPE_LABELS[deliverable.type as keyof typeof DELIVERABLE_TYPE_LABELS] ||
          deliverable.type
        }
        title={deliverable.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(deliverable.status)} dot>
              {DELIVERABLE_STATUS_LABELS[deliverable.status as keyof typeof DELIVERABLE_STATUS_LABELS] ||
                deliverable.status}
            </Badge>
            {deliverable.dueDate && <span>Due {formatDate(deliverable.dueDate)}</span>}
          </span>
        }
        actions={
          <DropdownMenu>
            <DropdownMenuDots label="Deliverable actions" />
            <DropdownMenuContent>
              <DropdownMenuItem destructive icon={<Trash2 />} onSelect={() => setShowDelete(true)}>
                Delete deliverable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Edit form */}
        <div className="space-y-6 lg:col-span-2">
          <Card padding="lg">
            <CardHeader title="Details" description="Everything about this deliverable" />
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup label="Due Date" htmlFor="d-due">
                  <Input
                    id="d-due"
                    name="dueDate"
                    type="date"
                    defaultValue={
                      deliverable.dueDate ? new Date(deliverable.dueDate).toISOString().split("T")[0] : ""
                    }
                  />
                </FormGroup>
              </div>

              <FormGroup label="Notes" htmlFor="d-notes">
                <Textarea id="d-notes" name="notes" rows={3} defaultValue={deliverable.notes || ""} placeholder="Internal notes..." />
              </FormGroup>

              <FormGroup label="Outcome / Win" htmlFor="d-outcome">
                <Textarea
                  id="d-outcome"
                  name="outcome"
                  rows={2}
                  defaultValue={deliverable.outcome || ""}
                  placeholder="What was the result? (shown to client)"
                />
              </FormGroup>

              <FormGroup label="Client Visible" htmlFor="d-visible" className="sm:max-w-xs">
                <Select
                  id="d-visible"
                  name="isClientVisible"
                  defaultValue={deliverable.isClientVisible ? "true" : "false"}
                >
                  <option value="true">Yes — visible to client</option>
                  <option value="false">No — internal only</option>
                </Select>
              </FormGroup>

              <FormActions>
                <Button type="submit" loading={saving}>
                  Save Changes
                </Button>
              </FormActions>
            </form>
          </Card>

          {/* Notes & feedback */}
          <Card padding="lg">
            <CardHeader
              title={`Notes & Feedback (${deliverable.comments.length})`}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddNote(true)}
                  leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                >
                  Add Note
                </Button>
              }
            />
            {deliverable.comments.length > 0 ? (
              <ul className="space-y-3">
                {deliverable.comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border bg-surface-1 p-4">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-primary">{c.user.name}</span>
                      <span className="text-xs text-ink-muted">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-ink-secondary">{c.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<MessageSquare />}
                title="No notes yet"
                description="Add feedback after the event."
              />
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card padding="lg">
            <CardHeader title="Move status" description="Logs the transition and notifies the team" />
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="xs"
                  variant={s === deliverable.status ? "primary" : "outline"}
                  onClick={() => quickStatus(s)}
                  disabled={s === deliverable.status || statusBusy !== null}
                  loading={statusBusy === s}
                >
                  {DELIVERABLE_STATUS_LABELS[s as keyof typeof DELIVERABLE_STATUS_LABELS] || s}
                </Button>
              ))}
            </div>
          </Card>

          {needsRunner && (
            <Card padding="lg" className="border-amber-200 bg-amber-50/60">
              <div className="flex items-start gap-3">
                <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-800">Runner needed</p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    This deliverable is confirmed. Assign a runner to handle it.
                  </p>
                  <Button className="mt-3" size="sm" onClick={() => setShowAssignRunner(true)}>
                    Assign Runner
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {deliverable.runnerAssignment && (
            <Card padding="lg">
              <CardHeader title="Runner Assignment" />
              <div className="space-y-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink-primary">
                    {deliverable.runnerAssignment.runner?.name || "Unassigned"}
                  </span>
                  <Badge tone={statusTone(deliverable.runnerAssignment.status)}>
                    {humanize(deliverable.runnerAssignment.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-ink-secondary">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  <span>
                    {formatDate(deliverable.runnerAssignment.eventDate)}
                    {deliverable.runnerAssignment.eventTime && (
                      <>
                        {" at "}
                        {new Date(deliverable.runnerAssignment.eventTime).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </span>
                </div>
                {deliverable.runnerAssignment.venueName && (
                  <div className="flex items-start gap-2 text-ink-secondary">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span>
                      {deliverable.runnerAssignment.venueName}
                      {deliverable.runnerAssignment.venueAddress && (
                        <span className="text-ink-muted"> — {deliverable.runnerAssignment.venueAddress}</span>
                      )}
                    </span>
                  </div>
                )}
                {deliverable.runnerAssignment.notes && (
                  <p className="text-xs text-ink-muted">{deliverable.runnerAssignment.notes}</p>
                )}
              </div>
            </Card>
          )}

          <Card padding="lg">
            <CardHeader title="Context" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="eyebrow">Client</dt>
                <dd className="mt-0.5 font-medium text-ink-primary">{deliverable.client.name}</dd>
              </div>
              <div>
                <dt className="eyebrow">Campaign</dt>
                <dd className="mt-0.5 text-ink-secondary">{deliverable.campaign?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="eyebrow">Counts toward</dt>
                <dd className="tabular mt-0.5 text-ink-secondary">
                  {deliverable.month}/{deliverable.year}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Completed</dt>
                <dd className="mt-0.5 text-ink-secondary">{formatDate(deliverable.completedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {/* Assign Runner Modal */}
      <AssignRunnerModal
        open={showAssignRunner}
        onOpenChange={setShowAssignRunner}
        deliverable={deliverable}
        runners={runners}
      />

      <ConfirmModal
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete deliverable?"
        description={`"${deliverable.title}" will be removed. Linked tasks, files and runner assignments are kept but unlinked.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* Add Note Modal */}
      {showAddNote && (
        <Modal
          open={showAddNote}
          onOpenChange={setShowAddNote}
          title="Add Note"
          description="Post-event feedback or notes"
        >
          <form onSubmit={addComment} className="space-y-4">
            <FormGroup label="Note" htmlFor="note-content" required>
              <Textarea
                id="note-content"
                name="content"
                rows={4}
                placeholder="Any feedback, issues, or wins..."
                required
                autoFocus
              />
            </FormGroup>
            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={notePosting}>
                Add Note
              </Button>
            </FormActions>
          </form>
        </Modal>
      )}
    </>
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Combine the date + "HH:mm" in the browser's timezone and send an absolute instant,
  // so the time shown later is the one that was typed regardless of server timezone.
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

    const body = {
      runnerId: form.get("runnerId") as string,
      eventName: deliverable.title,
      eventDate,
      clientId: deliverable.clientId,
      deliverableId: deliverable.id,
      arrivalTime: toInstant(eventDate, form.get("arrivalTime")),
      eventTime: toInstant(eventDate, form.get("eventTime")),
      venueName: (form.get("venueName") as string) || undefined,
      venueAddress: (form.get("venueAddress") as string) || undefined,
      location: (form.get("location") as string) || undefined,
      itemType:
        DELIVERABLE_TYPE_LABELS[deliverable.type as keyof typeof DELIVERABLE_TYPE_LABELS] ||
        deliverable.type,
      notes: (form.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch(`/api/clients/${deliverable.clientId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          title: "Failed to assign runner",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      if (data.conflictWarning) {
        // The assignment is saved; surface the scheduling conflict prominently.
        toast({
          title: "Scheduling conflict",
          description: `${data.conflictWarning}. The assignment was saved.`,
          variant: "error",
          duration: 10000,
        });
        router.refresh();
        return;
      }
      onOpenChange(false);
      toast({ title: "Runner assigned", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Assign Runner"
      description={`${deliverable.title} — ${deliverable.client.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {runners.length === 0 && (
          <Card padding="sm" className="border-amber-200 bg-amber-50/60">
            <p className="text-sm text-amber-800">No active runners found. Add a runner in Settings first.</p>
          </Card>
        )}

        <FormGroup label="Runner" htmlFor="ar-runner" required>
          <Select id="ar-runner" name="runnerId" required>
            <option value="">Select runner...</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Event Date" htmlFor="ar-date" required>
          <Input
            id="ar-date"
            name="eventDate"
            type="date"
            required
            defaultValue={deliverable.dueDate ? new Date(deliverable.dueDate).toISOString().split("T")[0] : ""}
          />
        </FormGroup>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Assign Runner
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
