"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button, Input, FormGroup } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Clock } from "lucide-react";

type HourEntry = {
  id: string;
  date: string | Date;
  hours: unknown;
  description: string | null;
  clientName: string | null;
};

export function RunnerHoursClient({ hours, totalHours }: { hours: HourEntry[]; totalHours: number }) {
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-ink-muted" />
              <span className="text-2xl font-bold text-ink-primary">{totalHours}h</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">This month</p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">+ Log Hours</Button>
      </div>

      {hours.length > 0 && (
        <div className="rounded-lg border border-border bg-white overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Hours</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Job</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hours.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 text-ink-secondary">{formatDate(h.date)}</td>
                  <td className="px-4 py-3 font-medium text-ink-primary">{Number(h.hours)}h</td>
                  <td className="px-4 py-3 text-ink-secondary">{h.clientName || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{h.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LogHoursModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}

function LogHoursModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      date: form.get("date") as string,
      hours: parseFloat(form.get("hours") as string),
      clientName: (form.get("clientName") as string) || undefined,
      description: (form.get("description") as string) || undefined,
    };

    const res = await fetch("/api/runner-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Failed to log hours");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Log Hours" description="Record hours for a job">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Date" htmlFor="rh-date" required>
            <Input id="rh-date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
          </FormGroup>
          <FormGroup label="Hours" htmlFor="rh-hours" required>
            <Input id="rh-hours" name="hours" type="number" step="0.5" min="0.5" max="24" required placeholder="e.g., 3.5" />
          </FormGroup>
        </div>

        <FormGroup label="Job / Client" htmlFor="rh-client">
          <Input id="rh-client" name="clientName" placeholder="e.g., Reykon — Red Carpet" />
        </FormGroup>

        <FormGroup label="Description" htmlFor="rh-desc">
          <Input id="rh-desc" name="description" placeholder="What did you do?" />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Log Hours"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
