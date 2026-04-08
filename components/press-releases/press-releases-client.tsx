"use client";

import { useState } from "react";
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
  scheduledDate: string | Date | null;
  sentAt: string | Date | null;
  approvedAt: string | Date | null;
  recipientCount: number | null;
  client: { id: string; name: string };
  createdBy: { id: string; name: string };
  createdAt: string | Date;
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

export function PressReleasesClient({ releases, clients }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  async function updateStatus(id: string, status: string, scheduledDate?: string) {
    await fetch(`/api/press-releases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, scheduledDate }),
    });
    router.refresh();
  }

  const drafts = releases.filter((r) => r.status === "DRAFT" || r.status === "PENDING_APPROVAL");
  const approved = releases.filter((r) => r.status === "APPROVED" || r.status === "SCHEDULED");
  const sent = releases.filter((r) => r.status === "SENT");

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowCreate(true)}>+ New Press Release</Button>
      </div>

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
            {releases.map((r) => (
              <tr key={r.id} className="hover:bg-surface-1 transition-colors">
                <td className="px-5 py-4 font-medium text-ink-primary">{r.title}</td>
                <td className="px-5 py-4 text-ink-secondary">{r.client.name}</td>
                <td className="px-5 py-4">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[r.status])}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-ink-secondary">{formatDate(r.scheduledDate)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    {r.status === "DRAFT" && (
                      <button onClick={() => updateStatus(r.id, "PENDING_APPROVAL")} className="text-xs text-amber-600 hover:underline">
                        Submit for Approval
                      </button>
                    )}
                    {r.status === "PENDING_APPROVAL" && (
                      <button onClick={() => updateStatus(r.id, "APPROVED")} className="text-xs text-blue-600 hover:underline">
                        Approve
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button onClick={() => {
                        const date = prompt("Schedule date (YYYY-MM-DD):");
                        if (date) updateStatus(r.id, "SCHEDULED", date);
                      }} className="text-xs text-purple-600 hover:underline">
                        Schedule
                      </button>
                    )}
                    {r.status === "SCHEDULED" && (
                      <button onClick={() => updateStatus(r.id, "SENT")} className="text-xs text-green-600 hover:underline">
                        Mark Sent
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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
    </>
  );
}

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
      title: form.get("title") as string,
      content: form.get("content") as string,
    };

    const res = await fetch("/api/press-releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Failed to create press release");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Press Release" description="Draft a press release for a client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Client" htmlFor="pr-client" required>
          <Select id="pr-client" name="clientId" required>
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Title" htmlFor="pr-title" required>
          <Input id="pr-title" name="title" placeholder="e.g., Reykon Announces World Tour 2026" required autoFocus />
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
