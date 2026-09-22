import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Server component: the client's strategy as live context for proposing goals.
 * Shown on the Deliverables page so the team sees what to look for before adding a goal.
 */
export async function StrategyContextCard({ clientId, strategyDocUrl }: { clientId: string; strategyDocUrl?: string | null }) {
  const [doc, items] = await Promise.all([
    db.strategyDocument.findUnique({
      where: { clientId },
      select: { objective: true, executionNotes: true, keyMessages: true },
    }),
    db.strategyItem.findMany({
      where: { clientId, status: { notIn: ["COMPLETED", "REJECTED"] } },
      select: { category: true, title: true, isBigWin: true },
      orderBy: [{ isBigWin: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!doc && items.length === 0) return null;

  const pick = (cat: string, n: number) => items.filter((i) => i.category === cat).slice(0, n).map((i) => i.title);
  const groups = [
    { label: "Medios", tone: "info" as const, names: pick("MEDIA_TARGET", 6), total: items.filter((i) => i.category === "MEDIA_TARGET").length },
    { label: "Creadores", tone: "purple" as const, names: pick("INFLUENCER", 6), total: items.filter((i) => i.category === "INFLUENCER").length },
    { label: "Marcas", tone: "warning" as const, names: pick("BRAND_OPPORTUNITY", 5), total: items.filter((i) => i.category === "BRAND_OPPORTUNITY").length },
    { label: "Eventos", tone: "success" as const, names: pick("EVENT", 5), total: items.filter((i) => i.category === "EVENT").length },
  ].filter((g) => g.total > 0);

  return (
    <Card padding="md" className="border-ink-primary/10 bg-surface-2/60">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-ink-muted" />
            <p className="eyebrow">Estrategia · qué buscar para las próximas metas</p>
          </div>
          {doc?.executionNotes && (
            <p className="text-sm leading-relaxed text-ink-primary">{doc.executionNotes}</p>
          )}
          {doc?.objective && (
            <p className="text-xs leading-relaxed text-ink-secondary"><span className="font-medium text-ink-primary">Objetivo: </span>{doc.objective}</p>
          )}
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {groups.map((g) => (
                <div key={g.label} className="min-w-0">
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted">
                    {g.label} <span className="tabular text-ink-muted/70">({g.total})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {g.names.map((n) => (
                      <Badge key={n} tone={g.tone} size="xs">{n}</Badge>
                    ))}
                    {g.total > g.names.length && <Badge tone="outline" size="xs">+{g.total - g.names.length}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
          <Link href={`/clients/${clientId}/strategy`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-3 text-xs font-medium text-ink-primary hover:bg-surface-2">
            Ver estrategia <ArrowRight className="h-3 w-3" />
          </Link>
          {strategyDocUrl && (
            <a href={strategyDocUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-ink-secondary hover:bg-white hover:text-ink-primary">
              Google Doc
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
