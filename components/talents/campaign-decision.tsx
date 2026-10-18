"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { Check, X, Send } from "lucide-react";

export function CampaignDecision({ id, status, canApprove }: { id: string; status: string; canApprove: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  async function act(action: "send" | "approve" | "reject") {
    setBusy(action);
    const res = await fetch(`/api/campaign-suggestions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: note || null }) }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) { let msg = "Error"; try { msg = (await res!.json()).error ?? msg; } catch { /* ignore */ } toast({ title: "No se pudo", description: msg, variant: "error" }); return; }
    toast({ title: action === "send" ? "Enviada a Esther y Benjy" : action === "approve" ? "Propuesta aprobada" : "Propuesta rechazada", variant: "success" });
    router.refresh();
  }
  if (status === "APPROVED" || status === "REJECTED") return null;
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      {status === "DRAFT" && <div className="mb-3"><Button onClick={() => act("send")} disabled={!!busy}><Send className="h-4 w-4" /> Enviar a Esther y Benjy para aprobación</Button></div>}
      {canApprove && (
        <>
          <p className="mb-2 text-sm font-medium">Decisión</p>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional (qué cambiar, con quién sí, con quién no)" />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => act("approve")} disabled={!!busy}><Check className="h-4 w-4" /> Aprobar</Button>
            <Button variant="secondary" onClick={() => act("reject")} disabled={!!busy}><X className="h-4 w-4" /> Rechazar</Button>
          </div>
        </>
      )}
    </div>
  );
}
