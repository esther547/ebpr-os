"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";
import { FileText, Send, Clock, Check } from "lucide-react";

type Release = {
  id: string;
  title: string;
  content: string;
  status: string;
  scheduledDate: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  recipientCount: number | null;
  client: { id: string; name: string };
  createdBy: { id: string; name: string };
  createdAt: string;
  tags: string[];
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-2 text-ink-secondary",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  SCHEDULED: "bg-purple-50 text-purple-700",
  SENT: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

interface Props {
  releases: Release[];
  clients: { id: string; name: string }[];
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

/** Local calendar date "YYYY-MM-DD" -> weekday check without UTC drift. */
function isWeekend(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = new Date(y, m - 1, d, 12).getDay();
  return day === 0 || day === 6;
}

function nextWeekdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function PressReleasesClient({ releases, clients }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [scheduling, setScheduling] = useState<Release | null>(null);
  const [sending, setSending] = useState<Release | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/press-releases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) {
      const msg = res ? await readError(res, "Failed to update press release") : "Network error";
      setError(msg);
      return false;
    }
    router.refresh();
    return true;
  }

  async function remove(r: Release) {
    if (!confirm(`Delete "${r.title}"? This can't be undone.`)) return;
    setBusyId(r.id);
    setError(null);
    const res = await fetch(`/api/press-releases/${r.id}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) {
      setError(res ? await readError(res, "Failed to delete press release") : "Network error");
      return;
    }
    router.refresh();
  }

  const drafts = releases.filter((r) => r.status === "DRAFT" || r.status === "PENDING_APPROVAL");
  const approved = releases.filter((r) => r.status === "APPROVED" || r.status === "SCHEDULED");
  const sent = releases.filter((r) => r.status === "SENT");

  const actionLink = "text-xs hover:underline disabled:opacity-40 disabled:no-underline";

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowCreate(true)}>+ New Press Release</Button>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-border bg-white p-4 text-center">
          <FileText className="mx-auto h-4 w-4 text-ink-muted mb-1" />
          <p className="text-xl font-bold text-ink-primary">{drafts.length}</p>
          <p className="text-xs text-ink-muted">Drafts</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 text-center">
          <Clock className="mx-auto h-4 w-4 text-amber-500 mb-1" />
          <p className="text-xl font-bold text-ink-primary">{releases.filter((r) => r.status === "PENDING_APPROVAL").length}</p>
          <p className="text-xs text-ink-muted">Pending Approval</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 text-center">
          <Send className="mx-auto h-4 w-4 text-purple-500 mb-1" />
          <p className="text-xl font-bold text-ink-primary">{approved.length}</p>
          <p className="text-xs text-ink-muted">Ready to Send</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 text-center">
          <Check className="mx-auto h-4 w-4 text-green-500 mb-1" />
          <p className="text-xl font-bold text-ink-primary">{sent.length}</p>
          <p className="text-xs text-ink-muted">Sent</p>
        </div>
      </div>

      {/* Releases Table */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-1">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Title</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Scheduled</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {releases.map((r) => {
              const busy = busyId === r.id;
              return (
                <tr key={r.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-ink-primary">{r.title}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {r.createdBy.name} · {formatDate(r.createdAt)}
                      {r.tags.length > 0 && <> · targets: {r.tags.join(", ")}</>}
                      {r.tags.length === 0 && <> · targets: all journalists</>}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{r.client.name}</td>
                  <td className="px-5 py-4">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[r.status])}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                    {r.status === "SENT" && r.recipientCount != null && (
                      <p className="text-2xs text-ink-muted mt-1">{r.recipientCount} recipients · {formatDate(r.sentAt)}</p>
                    )}
                    {r.approvedBy && r.status !== "SENT" && r.status !== "DRAFT" && (
                      <p className="text-2xs text-ink-muted mt-1">Approved by {r.approvedBy}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{formatDate(r.scheduledDate)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-3">
                      {r.status === "DRAFT" && (
                        <button disabled={busy} onClick={() => updateStatus(r.id, "PENDING_APPROVAL")} className={cn(actionLink, "text-amber-600")}>
                          Submit for Approval
                        </button>
                      )}
                      {r.status === "PENDING_APPROVAL" && (
                        <>
                          <button disabled={busy} onClick={() => updateStatus(r.id, "APPROVED")} className={cn(actionLink, "text-blue-600")}>
                            Approve
                          </button>
                          <button disabled={busy} onClick={() => updateStatus(r.id, "DRAFT")} className={cn(actionLink, "text-ink-muted")}>
                            Back to Draft
                          </button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <>
                          <button disabled={busy} onClick={() => setScheduling(r)} className={cn(actionLink, "text-purple-600")}>
                            Schedule
                          </button>
                          <button disabled={busy} onClick={() => updateStatus(r.id, "DRAFT")} className={cn(actionLink, "text-ink-muted")}>
                            Back to Draft
                          </button>
                        </>
                      )}
                      {r.status === "SCHEDULED" && (
                        <>
                          <button disabled={busy} onClick={() => setSending(r)} className={cn(actionLink, "text-green-600")}>
                            Mark Sent
                          </button>
                          <button disabled={busy} onClick={() => setScheduling(r)} className={cn(actionLink, "text-purple-600")}>
                            Reschedule
                          </button>
                        </>
                      )}
                      {r.status === "CANCELLED" && (
                        <button disabled={busy} onClick={() => updateStatus(r.id, "DRAFT")} className={cn(actionLink, "text-ink-muted")}>
                          Restore as Draft
                        </button>
                      )}
                      {r.status !== "SENT" && r.status !== "CANCELLED" && (
                        <button disabled={busy} onClick={() => updateStatus(r.id, "CANCELLED")} className={cn(actionLink, "text-red-600")}>
                          Cancel
                        </button>
                      )}
                      {r.status !== "SENT" && (
                        <button disabled={busy} onClick={() => remove(r)} className={cn(actionLink, "text-red-600")}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {releases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-ink-muted">
                  No press releases yet. Create the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateReleaseModal open={showCreate} onOpenChange={setShowCreate} clients={clients} />

      {scheduling && (
        <ScheduleModal
          release={scheduling}
          onClose={() => setScheduling(null)}
          onSchedule={async (ymd) => {
            const ok = await updateStatus(scheduling.id, "SCHEDULED", { scheduledDate: ymd });
            if (ok) setScheduling(null);
            return ok;
          }}
        />
      )}

      {sending && (
        <SendModal
          release={sending}
          onClose={() => setSending(null)}
          onConfirm={async () => {
            const ok = await updateStatus(sending.id, "SENT");
            if (ok) setSending(null);
            return ok;
          }}
        />
      )}
    </>
  );
}

// ─── Schedule (weekdays only) ─────────────────────────────

function ScheduleModal({
  release,
  onClose,
  onSchedule,
}: {
  release: Release;
  onClose: () => void;
  onSchedule: (ymd: string) => Promise<boolean>;
}) {
  const initial = release.scheduledDate ? release.scheduledDate.slice(0, 10) : nextWeekdayYmd();
  const [date, setDate] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekend = !!date && isWeekend(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    if (weekend) {
      setError("Press releases go out on weekdays only — pick a Monday to Friday date.");
      return;
    }
    setLoading(true);
    setError(null);
    const ok = await onSchedule(date);
    setLoading(false);
    if (!ok) setError("Could not schedule — see the message above the table.");
  }

  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} title="Schedule Distribution" description={release.title}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <FormGroup label="Send date (weekdays only)" htmlFor="pr-date" required>
          <Input id="pr-date" type="date" value={date} min={min} onChange={(e) => setDate(e.target.value)} required />
          {weekend && <p className="text-xs text-red-600">That&apos;s a weekend. Choose Monday–Friday.</p>}
        </FormGroup>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading || !date || weekend}>
            {loading ? "Scheduling..." : "Schedule"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Mark sent (shows recipient count from journalist DB) ─

function SendModal({
  release,
  onClose,
  onConfirm,
}: {
  release: Release;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qs = release.tags.length ? `?count=1&tag=${encodeURIComponent(release.tags.join(","))}` : "?count=1";
    fetch(`/api/journalists${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setCount(typeof d.total === "number" ? d.total : null))
      .catch(() => setCountError(true));
  }, [release.tags]);

  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} title="Mark as Sent" description={release.title}>
      <div className="space-y-4 text-sm text-ink-secondary">
        <p>
          Recipients are the active journalists matching{" "}
          {release.tags.length ? (
            <>beat/tags <span className="font-medium text-ink-primary">{release.tags.join(", ")}</span></>
          ) : (
            <span className="font-medium text-ink-primary">any beat (no tags set)</span>
          )}
          .
        </p>
        <div className="rounded-md bg-surface-1 px-4 py-3">
          {countError ? (
            <span className="text-red-600">Could not load the recipient count.</span>
          ) : count === null ? (
            "Counting recipients..."
          ) : (
            <>
              <span className="text-2xl font-bold text-ink-primary">{count.toLocaleString()}</span>{" "}
              journalist{count === 1 ? "" : "s"} will be recorded as recipients
            </>
          )}
        </div>
        {release.scheduledDate && (
          <p className="text-xs text-ink-muted">Scheduled for {formatDate(release.scheduledDate)}.</p>
        )}
        <p className="text-xs text-ink-muted">
          This records the release as sent with today&apos;s date. It does not email journalists from here.
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={async () => { setLoading(true); const ok = await onConfirm(); setLoading(false); if (!ok) onClose(); }}
            disabled={loading}
          >
            {loading ? "Saving..." : "Mark Sent"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create ───────────────────────────────────────────────

function CreateReleaseModal({ open, onOpenChange, clients }: { open: boolean; onOpenChange: (o: boolean) => void; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      clientId: form.get("clientId") as string,
      title: String(form.get("title") ?? "").trim(),
      content: String(form.get("content") ?? "").trim(),
      tags: String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    };

    const res = await fetch("/api/press-releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res || !res.ok) {
      setError(res ? await readError(res, "Failed to create press release") : "Network error");
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Press Release" description="Draft a press release for a client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Client" htmlFor="pr-client" required>
          <Select id="pr-client" name="clientId" required defaultValue="">
            <option value="" disabled>Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Title" htmlFor="pr-title" required>
          <Input id="pr-title" name="title" placeholder="e.g., Reykon Announces World Tour 2026" required autoFocus />
        </FormGroup>

        <FormGroup label="Target beats / tags (comma separated)" htmlFor="pr-tags">
          <Input id="pr-tags" name="tags" placeholder="e.g., Music, Entertainment, latin" />
          <p className="text-xs text-ink-muted">Journalists whose beat or tags match are the recipients. Leave empty to target everyone.</p>
        </FormGroup>

        <FormGroup label="Content" htmlFor="pr-content" required>
          <Textarea id="pr-content" name="content" rows={10} placeholder="Write the press release..." required />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Draft"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
