import { Badge, type BadgeTone } from "@/components/ui/badge";

export const STATUS: Record<string, { label: string; tone: BadgeTone }> = { DRAFT: { label: "Borrador", tone: "neutral" }, SENT: { label: "Enviada para aprobación", tone: "info" }, APPROVED: { label: "Aprobada", tone: "success" }, REJECTED: { label: "Rechazada", tone: "danger" } };
import type { Suggestion } from "@/lib/campaign-suggester";

const ROLE_ES: Record<string, { label: string; tone: "dark" | "info" | "neutral" }> = { lead: { label: "Lead", tone: "dark" }, support: { label: "Apoyo", tone: "info" }, reach: { label: "Alcance", tone: "neutral" } };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{title}</h3>{children}</section>;
}

/** Renders one campaign suggestion exactly as the model returned it. */
export function SuggestionView({ s }: { s: Suggestion }) {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <Section title="La marca"><p>{s.brandRead}</p><p className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-[13px]"><span className="font-semibold">Mercado asumido:</span> {s.marketAssumption}</p></Section>
      <Section title={`Shortlist · ${s.shortlist.length}`}>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {s.shortlist.map((t) => { const r = ROLE_ES[t.role] ?? { label: t.role, tone: "neutral" as const }; return (
            <li key={t.name} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{t.name}</span><Badge tone={r.tone}>{r.label}</Badge><span className="text-xs text-ink-muted">{t.reachSummary}</span></div>
              <p className="mt-1 text-[13px] text-ink-secondary">{t.whyThisOne}</p>
              {t.flag && <p className="mt-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">⚑ {t.flag}</p>}
            </li>); })}
        </ul>
      </Section>
      <Section title="Concepto"><p>{s.concept}</p></Section>
      <Section title="Paquete por creador"><p>{s.packagePerCreator}</p></Section>
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Preguntas abiertas"><ul className="list-disc space-y-1 pl-5 text-[13px]">{s.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul></Section>
        <Section title="Riesgos"><ul className="list-disc space-y-1 pl-5 text-[13px]">{s.risks.map((q, i) => <li key={i}>{q}</li>)}</ul></Section>
      </div>
      <p className="text-xs text-ink-muted">Los seguidores salen del roster y se verifican en el perfil antes de citarse a una marca. La propuesta no afirma disponibilidad ni tarifas.</p>
    </div>
  );
}
