"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";

/**
 * One checkable line, used where the list is rendered by a server component
 * (the client's deliverables page). Optimistic, then refreshes the server data.
 */
export function PriorityToggle({
  id,
  title,
  isDone,
  assigneeName,
}: {
  id: string;
  title: string;
  isDone: boolean;
  assigneeName?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [done, setDone] = useState(isDone);
  const [, startTransition] = useTransition();

  async function toggle() {
    const next = !done;
    setDone(next);
    try {
      const res = await fetch(`/api/priorities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: next }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(payload, "No se pudo guardar el cambio"));
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setDone(!next);
      toast({
        title: "No se pudo guardar el cambio",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <li className="flex items-start gap-2.5">
      <input
        type="checkbox"
        checked={done}
        onChange={() => void toggle()}
        aria-label={`Marcar "${title}" como hecha`}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong accent-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25"
      />
      <span
        className={cn(
          "min-w-0 break-words text-sm leading-snug",
          done ? "text-ink-muted line-through" : "text-ink-primary"
        )}
      >
        {title}
        {assigneeName && <span className="ml-1.5 text-xs text-ink-muted">· {assigneeName}</span>}
      </span>
    </li>
  );
}
