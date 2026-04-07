"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  deliverableId?: string;
  teamMembers: { id: string; name: string }[];
}

export function CreateTaskModal({ open, onOpenChange, clientId, deliverableId, teamMembers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const body = {
      title: form.get("title") as string,
      description: (form.get("description") as string) || undefined,
      clientId,
      deliverableId,
      assigneeId: (form.get("assigneeId") as string) || undefined,
      priority: form.get("priority") as string,
      dueDate: (form.get("dueDate") as string) || undefined,
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create task");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <FormGroup label="Task Title" htmlFor="task-title" required>
          <Input id="task-title" name="title" placeholder="e.g., Draft media pitch" required autoFocus />
        </FormGroup>

        <FormGroup label="Description" htmlFor="task-desc">
          <Textarea id="task-desc" name="description" rows={3} placeholder="Details..." />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Priority" htmlFor="task-priority">
            <Select id="task-priority" name="priority" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </FormGroup>

          <FormGroup label="Due Date" htmlFor="task-due">
            <Input id="task-due" name="dueDate" type="date" />
          </FormGroup>
        </div>

        <FormGroup label="Assigned To" htmlFor="task-assignee">
          <Select id="task-assignee" name="assigneeId">
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Task"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
