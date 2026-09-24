"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { SUGGESTION_STATUS_LABEL, type SuggestionStatusValue } from "@/lib/client-suggestions-format";
import { ApiKeySetupCard } from "./api-key-setup-card";
import { GenerateSuggestionsButton } from "./generate-suggestions-button";
import { SuggestionCard, type CardActions } from "./suggestion-card";
import {
  GENERATING_EVENT,
  type GeneratingDetail,
  type SuggestionGroups,
  type SuggestionItem,
  type TeamMember,
} from "./types";

const STATUS_TOAST: Record<SuggestionStatusValue, string> = {
  NEW: "Volvió a nuevas",
  IN_PROGRESS: "Marcada en curso",
  DONE: "Marcada como lograda",
  DISMISSED: "Sugerencia descartada",
};

export function SuggestionsBoard({
  clientId,
  clientName,
  groups,
  team,
  currentUserId,
  configured,
}: {
  clientId: string;
  clientName: string;
  groups: SuggestionGroups;
  team: TeamMember[];
  currentUserId: string;
  configured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    const onGenerating = (e: Event) => setGenerating(!!(e as CustomEvent<GeneratingDetail>).detail?.active);
    window.addEventListener(GENERATING_EVENT, onGenerating);
    return () => window.removeEventListener(GENERATING_EVENT, onGenerating);
  }, []);

  async function call(url: string, method: "POST" | "PATCH", body: unknown, fallback: string) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: apiErrorMessage(data, fallback), variant: "error" });
        return null;
      }
      return data;
    } catch {
      toast({ title: fallback, description: "Revisa tu conexión e intenta de nuevo", variant: "error" });
      return null;
    }
  }

  const base = `/api/clients/${clientId}/suggestions`;
  const actions: CardActions = {
    async setStatus(s, status) {
      const data = await call(`${base}/${s.id}`, "PATCH", { status }, "No se pudo actualizar la sugerencia");
      if (!data) return false;
      toast({ title: STATUS_TOAST[status], variant: "success" });
      router.refresh();
      return true;
    },
    async edit(s, patch) {
      const data = await call(`${base}/${s.id}`, "PATCH", patch, "No se pudo guardar la sugerencia");
      if (!data) return false;
      toast({ title: "Sugerencia actualizada", variant: "success" });
      router.refresh();
      return true;
    },
    async toGoal(s, assigneeId) {
      const data = await call(`${base}/${s.id}/to-goal`, "POST", { assigneeId }, "No se pudo crear la meta");
      if (!data) return false;
      toast({ title: "Meta creada en outreach", description: "La encuentras en Deliverables del ciclo actual.", variant: "success" });
      router.refresh();
      return true;
    },
    async toPriority(s) {
      const data = await call(`${base}/${s.id}/to-priority`, "POST", {}, "No se pudo agregar a prioridades");
      if (!data) return false;
      toast({ title: "Agregada a las prioridades de esta semana", variant: "success" });
      router.refresh();
      return true;
    },
  };

  const total = groups.NEW.length + groups.IN_PROGRESS.length + groups.DONE.length + groups.DISMISSED.length;

  const renderGrid = (items: SuggestionItem[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} clientId={clientId} team={team} currentUserId={currentUserId} actions={actions} />
      ))}
    </div>
  );

  const section = (status: SuggestionStatusValue, hint: string) =>
    groups[status].length > 0 && (
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-ink-primary">{SUGGESTION_STATUS_LABEL[status]}</h2>
          <span className="text-xs text-ink-muted tabular">{groups[status].length}</span>
          <span className="hidden text-xs text-ink-muted sm:inline">· {hint}</span>
        </div>
        {renderGrid(groups[status])}
      </section>
    );

  return (
    <div className="space-y-6">
      {!configured && <ApiKeySetupCard />}

      {generating && (
        <Card padding="md" className="border-accent2/30 bg-accent2-soft/40" aria-live="polite">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent2" />
            <div>
              <p className="text-sm font-medium text-ink-primary">Analizando el perfil de {clientName}…</p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Claude está leyendo la estrategia, el wish list, las metas, la agenda, los viajes y los eventos que vienen. Suele tardar entre 20 y 60 segundos.
              </p>
            </div>
          </div>
        </Card>
      )}

      {total === 0 ? (
        !generating && (
          <EmptyState
            icon={<Lightbulb />}
            title={`Todavía no hay sugerencias para ${clientName}`}
            description="Claude lee el perfil del cliente (estrategia, wish list, metas logradas, agenda, viajes y eventos de la industria) y propone 6 a 8 movimientos de PR concretos para que el equipo los ejecute en las próximas semanas. Cada uno se puede convertir en meta o mandar a las prioridades."
            action={
              configured ? (
                <GenerateSuggestionsButton clientId={clientId} clientName={clientName} withMode={false} />
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatTile className="p-3 sm:p-5" label="Nuevas" value={groups.NEW.length} hint={<span className="hidden sm:inline">por revisar</span>} />
            <StatTile className="p-3 sm:p-5" label="En curso" value={groups.IN_PROGRESS.length} hint={<span className="hidden sm:inline">el equipo las trabaja</span>} />
            <StatTile
              className="p-3 sm:p-5"
              label="Logradas"
              value={groups.DONE.length}
              tone={groups.DONE.length ? "success" : "neutral"}
              hint={<span className="hidden sm:inline">movimientos logrados</span>}
            />
          </div>

          {section("NEW", "propuestas por Claude para revisar")}
          {section("IN_PROGRESS", "metas o prioridades en marcha")}
          {section("DONE", "movimientos que se lograron")}

          {groups.DISMISSED.length > 0 && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setShowDismissed((v) => !v)}
                aria-expanded={showDismissed}
                className="flex items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink-primary"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", !showDismissed && "-rotate-90")} />
                {SUGGESTION_STATUS_LABEL.DISMISSED}
                <span className="text-xs font-normal text-ink-muted tabular">{groups.DISMISSED.length}</span>
              </button>
              {showDismissed && renderGrid(groups.DISMISSED)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
