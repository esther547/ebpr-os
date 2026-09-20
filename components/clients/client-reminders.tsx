"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button, Input, FormGroup, Select, FormActions } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

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

const TYPE_TONES: Record<string, BadgeTone> = {
  event: "purple",
  deliverable: "info",
  general: "neutral",
};

export function ClientReminders({ clientId, reminders }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function markDone(id: string) {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not complete reminder",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        return;
      }
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
    }
  }

  const active = reminders.filter((r) => !r.isDone);

  return (
    <Card padding="lg">
      <CardHeader
        title="Reminders"
        actions={
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Add
          </Button>
        }
      />

      {active.length > 0 ? (
        <ul className="space-y-2.5">
          {active.map((r) => {
            const isPast = new Date(r.remindAt) < new Date();
            return (
              <li key={r.id} className="flex items-start gap-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => markDone(r.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border transition-colors hover:border-ink-primary hover:bg-surface-2"
                  title="Mark done"
                  aria-label={`Mark "${r.title}" done`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-primary">{r.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={isPast ? "text-xs font-medium text-red-600" : "text-xs text-ink-muted"}>
                      {formatDate(r.remindAt)}
                    </span>
                    {r.type && (
                      <Badge size="xs" tone={TYPE_TONES[r.type] ?? "neutral"} className="capitalize">
                        {r.type}
                      </Badge>
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
    </Card>
  );
}

function AddReminderModal({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      clientId,
      title: (form.get("title") as string).trim(),
      remindAt: form.get("remindAt") as string,
      type: (form.get("type") as string) || undefined,
    };

    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not add reminder",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }
      onOpenChange(false);
      setLoading(false);
      toast({ title: "Reminder added", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Reminder" description="Set a reminder for this client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Reminder" htmlFor="rem-title" required>
          <Input id="rem-title" name="title" placeholder="e.g., Follow up on interview" required autoFocus />
        </FormGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Date" htmlFor="rem-date" required>
            <Input id="rem-date" name="remindAt" type="date" required />
          </FormGroup>
          <FormGroup label="Type" htmlFor="rem-type">
            <Select id="rem-type" name="type">
              <option value="">General</option>
              <option value="event">Event</option>
              <option value="deliverable">Deliverable</option>
            </Select>
          </FormGroup>
        </div>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add Reminder
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
