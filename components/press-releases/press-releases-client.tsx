"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuDots,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Send,
  Clock,
  Check,
  Plus,
  CalendarClock,
  Undo2,
  ThumbsUp,
  Ban,
  Trash2,
  RotateCcw,
} from "lucide-react";

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

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  SCHEDULED: "purple",
  SENT: "success",
  CANCELLED: "danger",
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
  const [deleting, setDeleting] = useState<Release | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    setBusyId(id);
    const res = await fetch(`/api/press-releases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) {
      toast({
        title: "Could not update press release",
        description: res ? await readError(res, "Failed to update press release") : "Network error",
        variant: "error",
      });
      return false;
    }
    toast({ title: `Moved to ${STATUS_LABELS[status] ?? status}`, variant: "success" });
    router.refresh();
    return true;
  }

  async function remove(r: Release) {
    setBusyId(r.id);
    const res = await fetch(`/api/press-releases/${r.id}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) {
      toast({
        title: "Could not delete press release",
        description: res ? await readError(res, "Failed to delete press release") : "Network error",
        variant: "error",
      });
      return false;
    }
    toast({ title: "Press release deleted", variant: "success" });
    router.refresh();
    return true;
  }

  const drafts = releases.filter((r) => r.status === "DRAFT" || r.status === "PENDING_APPROVAL");
  const approved = releases.filter((r) => r.status === "APPROVED" || r.status === "SCHEDULED");
  const sent = releases.filter((r) => r.status === "SENT");
  const pendingApproval = releases.filter((r) => r.status === "PENDING_APPROVAL");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-xs text-ink-muted">
          Drafts move through approval, scheduling and distribution. Recipients come from the journalist database.
        </p>
        <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
          New Press Release
        </Button>
      </div>

      {/* Pipeline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Drafts" value={drafts.length} icon={<FileText />} />
        <StatTile
          label="Pending Approval"
          value={pendingApproval.length}
          icon={<Clock />}
          tone={pendingApproval.length > 0 ? "warning" : "neutral"}
          hint={pendingApproval.length > 0 ? "needs review" : "nothing waiting"}
        />
        <StatTile label="Ready to Send" value={approved.length} icon={<Send />} />
        <StatTile label="Sent" value={sent.length} icon={<Check />} />
      </div>

      <section>
        <SectionHeader
          title="All Press Releases"
          description={`${releases.length} total`}
        />
        {releases.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No press releases yet"
            description="Draft a release for a client, route it for approval, then schedule distribution."
            action={
              <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
                New Press Release
              </Button>
            }
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <TableWrap className="rounded-none border-0 shadow-none">
              <Table>
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Client</Th>
                    <Th>Status</Th>
                    <Th>Scheduled</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r) => {
                    const busy = busyId === r.id;
                    return (
                      <tr key={r.id}>
                        <Td>
                          <p className="font-medium text-ink-primary">{r.title}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {r.createdBy.name} · {formatDate(r.createdAt)}
                            {r.tags.length > 0 ? ` · targets: ${r.tags.join(", ")}` : " · targets: all journalists"}
                          </p>
                        </Td>
                        <Td className="text-ink-secondary">{r.client.name}</Td>
                        <Td>
                          <Badge tone={STATUS_TONES[r.status] ?? "neutral"} dot>
                            {STATUS_LABELS[r.status] || r.status}
                          </Badge>
                          {r.status === "SENT" && r.recipientCount != null && (
                            <p className="mt-1 text-2xs text-ink-muted">
                              {r.recipientCount} recipients · {formatDate(r.sentAt)}
                            </p>
                          )}
                          {r.approvedBy && r.status !== "SENT" && r.status !== "DRAFT" && (
                            <p className="mt-1 text-2xs text-ink-muted">Approved by {r.approvedBy}</p>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-ink-secondary tabular">
                          {formatDate(r.scheduledDate)}
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuDots
                                label={`Actions for ${r.title}`}
                                className={busy ? "pointer-events-none opacity-50" : undefined}
                              />
                              <DropdownMenuContent>
                                {r.status === "DRAFT" && (
                                  <DropdownMenuItem
                                    icon={<Clock />}
                                    disabled={busy}
                                    onSelect={() => void updateStatus(r.id, "PENDING_APPROVAL")}
                                  >
                                    Submit for Approval
                                  </DropdownMenuItem>
                                )}
                                {r.status === "PENDING_APPROVAL" && (
                                  <>
                                    <DropdownMenuItem
                                      icon={<ThumbsUp />}
                                      disabled={busy}
                                      onSelect={() => void updateStatus(r.id, "APPROVED")}
                                    >
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      icon={<Undo2 />}
                                      disabled={busy}
                                      onSelect={() => void updateStatus(r.id, "DRAFT")}
                                    >
                                      Back to Draft
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {r.status === "APPROVED" && (
                                  <>
                                    <DropdownMenuItem
                                      icon={<CalendarClock />}
                                      disabled={busy}
                                      onSelect={() => setScheduling(r)}
                                    >
                                      Schedule
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      icon={<Undo2 />}
                                      disabled={busy}
                                      onSelect={() => void updateStatus(r.id, "DRAFT")}
                                    >
                                      Back to Draft
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {r.status === "SCHEDULED" && (
                                  <>
                                    <DropdownMenuItem
                                      icon={<Send />}
                                      disabled={busy}
                                      onSelect={() => setSending(r)}
                                    >
                                      Mark Sent
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      icon={<CalendarClock />}
                                      disabled={busy}
                                      onSelect={() => setScheduling(r)}
                                    >
                                      Reschedule
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {r.status === "CANCELLED" && (
                                  <DropdownMenuItem
                                    icon={<RotateCcw />}
                                    disabled={busy}
                                    onSelect={() => void updateStatus(r.id, "DRAFT")}
                                  >
                                    Restore as Draft
                                  </DropdownMenuItem>
                                )}
                                {r.status !== "SENT" && r.status !== "CANCELLED" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      icon={<Ban />}
                                      destructive
                                      disabled={busy}
                                      onSelect={() => void updateStatus(r.id, "CANCELLED")}
                                    >
                                      Cancel
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {r.status !== "SENT" && (
                                  <>
                                    {r.status === "CANCELLED" && <DropdownMenuSeparator />}
                                    <DropdownMenuItem
                                      icon={<Trash2 />}
                                      destructive
                                      disabled={busy}
                                      onSelect={() => setDeleting(r)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </section>

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

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title={deleting ? `Delete "${deleting.title}"?` : "Delete press release?"}
        description="This can't be undone. The draft and its content are removed permanently."
        confirmLabel="Delete"
        destructive
        loading={!!deleting && busyId === deleting.id}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await remove(deleting);
          if (ok) setDeleting(null);
        }}
      />
    </div>
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
  const { toast } = useToast();

  const weekend = !!date && isWeekend(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    if (weekend) {
      toast({
        title: "Weekdays only",
        description: "Press releases go out Monday to Friday — pick a weekday.",
        variant: "error",
      });
      return;
    }
    setLoading(true);
    await onSchedule(date);
    setLoading(false);
  }

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Schedule Distribution"
      description={release.title}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <FormGroup
          label="Send date"
          htmlFor="pr-date"
          hint="weekdays only"
          required
          description="Distribution days are Monday through Friday."
        >
          <Input
            id="pr-date"
            type="date"
            value={date}
            min={min}
            onChange={(e) => setDate(e.target.value)}
            error={weekend ? "That's a weekend. Choose Monday–Friday." : undefined}
            required
          />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!date || weekend}>
            Schedule
          </Button>
        </FormActions>
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
    <Modal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Mark as Sent"
      description={release.title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            onClick={async () => {
              setLoading(true);
              const ok = await onConfirm();
              setLoading(false);
              if (!ok) onClose();
            }}
          >
            Mark Sent
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow">Targeting</span>
          {release.tags.length ? (
            release.tags.map((t) => <Badge key={t} tone="info">{t}</Badge>)
          ) : (
            <Badge tone="neutral">Any beat (no tags set)</Badge>
          )}
        </div>

        <StatTile
          label="Recipients"
          value={countError ? "—" : count === null ? "…" : count.toLocaleString()}
          tone={countError ? "danger" : "neutral"}
          hint={
            countError
              ? "Could not load the recipient count."
              : count === null
                ? "Counting active journalists…"
                : `active journalist${count === 1 ? "" : "s"} will be recorded as recipients`
          }
        />

        {release.scheduledDate && (
          <p className="text-xs text-ink-muted">Scheduled for {formatDate(release.scheduledDate)}.</p>
        )}
        <p className="text-xs text-ink-muted">
          This records the release as sent with today&apos;s date. It does not email journalists from here.
        </p>
      </div>
    </Modal>
  );
}

// ─── Create ───────────────────────────────────────────────

function CreateReleaseModal({ open, onOpenChange, clients }: { open: boolean; onOpenChange: (o: boolean) => void; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

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
      toast({
        title: "Could not create press release",
        description: res ? await readError(res, "Failed to create press release") : "Network error",
        variant: "error",
      });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({ title: "Draft created", description: body.title, variant: "success" });
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New Press Release"
      description="Draft a press release for a client"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <FormGroup
          label="Target beats / tags"
          htmlFor="pr-tags"
          hint="comma separated"
          description="Journalists whose beat or tags match are the recipients. Leave empty to target everyone."
        >
          <Input id="pr-tags" name="tags" placeholder="e.g., Music, Entertainment, latin" />
        </FormGroup>

        <FormGroup label="Content" htmlFor="pr-content" required>
          <Textarea id="pr-content" name="content" rows={10} placeholder="Write the press release..." required />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Draft
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
