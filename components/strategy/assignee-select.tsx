"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export type Strategist = { id: string; name: string };

/** "A cargo": the strategist responsible for a strategy item; saving mirrors it on their to-dos. */
export function AssigneeSelect({ clientId, itemId, assigneeId, strategists, className }: { clientId: string; itemId: string; assigneeId: string | null; strategists: Strategist[]; className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(assigneeId ?? "");
  const [saving, setSaving] = useState(false);
  async function save(next: string) {
    const prev = value; setValue(next); setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/strategy/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId: next || null }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setValue(prev); toast({ title: typeof d?.error === "string" ? d.error : "No se pudo asignar", variant: "error" }); return; }
      const name = strategists.find((s) => s.id === next)?.name;
      toast({ title: name ? `A cargo de ${name}` : "Sin responsable", description: name ? "Ya aparece en sus to dos." : undefined, variant: "success" });
      router.refresh();
    } finally { setSaving(false); }
  }
  return (
    <select
      value={value}
      onChange={(e) => void save(e.target.value)}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      aria-label="A cargo"
      title="A cargo"
      className={cn("h-7 max-w-[9.5rem] shrink-0 rounded-md border bg-white px-1.5 text-xs text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25", value ? "border-border" : "border-dashed border-border-strong text-ink-muted", className)}
    >
      <option value="">A cargo…</option>
      {strategists.map((s) => (<option key={s.id} value={s.id}>{s.name.split(" ")[0]}</option>))}
    </select>
  );
}
