"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, FormGroup } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Clock } from "lucide-react";
import { formatDayKey } from "@/components/runners/miami-time";

type HourEntry = {
  id: string;
  date: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  hours: number;
  description: string | null;
  clientName: string | null;
};

export function RunnerHoursClient({
  hours,
  totalHours,
  todayKey,
}: {
  hours: HourEntry[];
  totalHours: number;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
}) {
  const [showAdd, setShowAdd] = useState(false);

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
                  <td className="px-4 py-3 text-ink-secondary">{formatDayKey(h.dayKey, "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 font-medium text-ink-primary">{h.hours}h</td>
                  <td className="px-4 py-3 text-ink-secondary">{h.clientName || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{h.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LogHoursModal open={showAdd} onOpenChange={setShowAdd} todayKey={todayKey} />
    </div>
  );
}

function LogHoursModal({
  open,
  onOpenChange,
  todayKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  todayKey: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const hoursValue = parseFloat(form.get("hours") as string);
    if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
      setError("Please enter a valid number of hours");
      setLoading(false);
      return;
    }
    const body = {
      date: form.get("date") as string,
      hours: hoursValue,
      clientName: ((form.get("clientName") as string) || "").trim() || undefined,
      description: ((form.get("description") as string) || "").trim() || undefined,
    };

    try {
      const res = await fetch("/api/runner-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = data?.error;
        setError(
          typeof err === "string"
            ? err
            : err && typeof err === "object"
              ? Object.values(err as Record<string, string[]>).flat().join(", ")
              : "Failed to log hours"
        );
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Log Hours" description="Record hours for a job">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Date" htmlFor="rh-date" required>
            <Input id="rh-date" name="date" type="date" required defaultValue={todayKey} max={todayKey} />
          </FormGroup>
          <FormGroup label="Hours" htmlFor="rh-hours" required>
            <Input id="rh-hours" name="hours" type="number" step="0.25" min="0.25" max="24" required placeholder="e.g., 3.5" />
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
