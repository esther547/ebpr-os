"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button, Input, FormGroup, Select } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Bell, Check, Plus } from "lucide-react";

type Reminder = {
  id: string;
  title: string;
  description: string | null;
  remindAt: string | Date;
  type: string | null;
  isDone: boolean;
  createdBy: { name: string };
};

interface Props {
  clientId: string;
  reminders: Reminder[];
}

const TYPE_STYLES: Record<string, string> = {
  event: "bg-purple-50 text-purple-700",
  deliverable: "bg-blue-50 text-blue-700",
  payment: "bg-amber-50 text-amber-700",
  general: "bg-surface-2 text-ink-secondary",
};

export function ClientReminders({ clientId, reminders }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();

  async function markDone(id: string) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const active = reminders.filter((r) => !r.isDone);

  return (
    <section className="rounded-lg border border-border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-ink-muted" />
          <h2 className="font-semibold text-ink-primary">Reminders</h2>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary transition-colors"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {active.length > 0 ? (
        <ul className="space-y-2">
          {active.map((r) => {
            const isPast = new Date(r.remindAt) < new Date();
            return (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <button
                  onClick={() => markDone(r.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-border hover:border-green-500 hover:bg-green-50 transition-colors"
                  title="Mark done"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-primary">{r.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${isPast ? "text-red-600 font-medium" : "text-ink-muted"}`}>
                      {formatDate(r.remindAt)}
                    </span>
                    {r.type && (
                      <span className={`rounded-full px-1.5 py-0.5 text-2xs font-medium ${TYPE_STYLES[r.type] || TYPE_STYLES.general}`}>
                        {r.type}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No active reminders</p>
      )}

      <AddReminderModal open={showAdd} onOpenChange={setShowAdd} clientId={clientId} />
    </section>
  );
}

function AddReminderModal({ open, onOpenChange, clientId }: { open: boolean; onOpenChange: (o: boolean) => void; clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      clientId,
      title: form.get("title") as string,
      remindAt: form.get("remindAt") as string,
      type: form.get("type") as string || undefined,
    };

    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    onOpenChange(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Reminder" description="Set a reminder for this client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Reminder" htmlFor="rem-title" required>
          <Input id="rem-title" name="title" placeholder="e.g., Follow up on interview" required autoFocus />
        </FormGroup>
        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Date" htmlFor="rem-date" required>
            <Input id="rem-date" name="remindAt" type="date" required />
          </FormGroup>
          <FormGroup label="Type" htmlFor="rem-type">
            <Select id="rem-type" name="type">
              <option value="">General</option>
              <option value="event">Event</option>
              <option value="deliverable">Deliverable</option>
              <option value="payment">Payment</option>
            </Select>
          </FormGroup>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Reminder"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
