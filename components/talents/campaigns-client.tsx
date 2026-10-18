"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Textarea } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { Sparkles, Send, Loader2, Trash2 } from "lucide-react";
import { SuggestionView, STATUS } from "./suggestion-view";
import type { Suggestion } from "@/lib/campaign-suggester";

export type CampaignRow = { id: string; brand: string; brief: string | null; status: string; createdAt: string; sentAt: string | null; decidedAt: string | null; decisionNote: string | null; createdBy: string; result: Suggestion };

async function readError(res: Response, fallback: string) { try { const d = await res.json(); return typeof d.error === "string" ? d.error : fallback; } catch { return fallback; } }

export function CampaignsClient({ campaigns, talentCount, meId, isAdmin }: { campaigns: CampaignRow[]; talentCount: number; meId: string; isAdmin: boolean }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<CampaignRow | null>(null);
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<CampaignRow | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function run() {
    const raw = text.trim(); if (!raw) return;
    // First line is the brand, the rest is what we know (budget, timing, market…)
    const [first, ...rest] = raw.split("\n"); const brand = first.trim(); const brief = rest.join("\n").trim();
    setRunning(true); setCurrent(null);
    const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand, brief: brief || null }) }).catch(() => null);
    setRunning(false);
    if (!res || !res.ok) { toast({ title: "No salió la propuesta", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const data = await res.json();
    setCurrent({ ...data.campaign, createdBy: "Tú", result: data.campaign.result });
    router.refresh();
  }

  async function send(c: CampaignRow) {
    setSending(true);
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send" }) }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) { toast({ title: "No se pudo enviar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const data = await res.json();
    toast({ title: "Enviada para aprobación", description: `A ${(data.campaign.sentTo as string[]).join(", ")}`, variant: "success" });
    setCurrent((cur) => (cur && cur.id === c.id ? { ...cur, status: "SENT", sentAt: data.campaign.sentAt } : cur));
    router.refresh();
  }

  async function remove(c: CampaignRow) {
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo borrar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return false; }
    if (current?.id === c.id) setCurrent(null);
    router.refresh(); return true;
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-base font-semibold">Escribe la marca y listo</h2>
        <p className="mt-1 text-sm text-ink-secondary">Una línea basta: <span className="font-medium">Dyson Mexico</span>. Si sabes más (presupuesto, fechas, entregables, mercado), ponlo debajo en la misma caja. La propuesta usa solo el roster ({talentCount} talentos) y no inventa cifras.</p>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Sephora Mexico\nLanzamiento de fragancia en noviembre, 5 creadores, solo México"} className="mt-3" disabled={running}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }} />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={run} disabled={running || !text.trim()}>{running ? <><Loader2 className="h-4 w-4 animate-spin" /> Pensando (1–3 min)…</> : <><Sparkles className="h-4 w-4" /> Proponer campaña</>}</Button>
          {running && <span className="text-xs text-ink-muted">Claude lee el roster completo y arma la propuesta. No cierres la página.</span>}
        </div>
      </Card>

      {current && (
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">Propuesta</p><h2 className="text-lg font-semibold">{current.brand}</h2>{current.brief && <p className="text-xs text-ink-secondary">{current.brief}</p>}</div>
            <div className="flex items-center gap-2">
              <Badge tone={STATUS[current.status]?.tone ?? "neutral"}>{STATUS[current.status]?.label ?? current.status}</Badge>
              {current.status === "DRAFT" && <Button onClick={() => send(current)} disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar a Esther y Benjy</Button>}
            </div>
          </div>
          <SuggestionView s={current.result} />
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted">Propuestas anteriores</h2>
        {campaigns.length === 0 ? <p className="text-sm text-ink-muted">Todavía no hay propuestas.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-white">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button className="flex-1 text-left" onClick={() => setCurrent(c)}>
                  <span className="font-medium">{c.brand}</span>
                  <span className="ml-2 text-xs text-ink-muted">{c.createdBy} · {new Date(c.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {c.result.shortlist.length} talentos</span>
                </button>
                <Badge tone={STATUS[c.status]?.tone ?? "neutral"}>{STATUS[c.status]?.label ?? c.status}</Badge>
                <Link href={`/talentos/campanas/${c.id}`} className="text-xs text-ink-secondary underline">Abrir</Link>
                {(isAdmin || c.createdBy === meId) && <button onClick={() => setRemoving(c)} className="text-ink-muted hover:text-red-600" title="Borrar"><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmModal open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }} title="Borrar propuesta" description={removing ? `Se borra la propuesta de ${removing.brand}.` : ""} confirmLabel="Borrar" onConfirm={async () => { if (removing && (await remove(removing))) setRemoving(null); }} />
    </div>
  );
}
