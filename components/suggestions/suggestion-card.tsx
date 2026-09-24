"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, CircleDot, ListPlus, Pencil, RotateCcw, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/form-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuDots,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { categoryLabel, type SuggestionStatusValue } from "@/lib/client-suggestions-format";
import { ConvertToGoalModal } from "./convert-to-goal-modal";
import { EditSuggestionModal } from "./edit-suggestion-modal";
import type { SuggestionItem, TeamMember } from "./types";

const CATEGORY_TONE: Record<string, BadgeTone> = {
  MEDIA_TARGET: "info",
  INFLUENCER: "purple",
  EVENT: "success",
  BRAND_OPPORTUNITY: "warning",
  SOCIAL_MEDIA: "neutral",
  PRESS_RELEASE: "dark",
  OTHER: "outline",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "America/New_York" });
}

export type CardActions = {
  setStatus: (s: SuggestionItem, status: SuggestionStatusValue) => Promise<boolean>;
  edit: (s: SuggestionItem, patch: { title: string; rationale: string }) => Promise<boolean>;
  toGoal: (s: SuggestionItem, assigneeId: string) => Promise<boolean>;
  toPriority: (s: SuggestionItem) => Promise<boolean>;
};

export function SuggestionCard({
  suggestion: s,
  clientId,
  team,
  currentUserId,
  actions,
}: {
  suggestion: SuggestionItem;
  clientId: string;
  team: TeamMember[];
  currentUserId: string;
  actions: CardActions;
}) {
  const [goalOpen, setGoalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<boolean>) {
    setBusy(key);
    await fn();
    setBusy(null);
  }

  const muted = s.status === "DISMISSED";
  const active = s.status === "NEW" || s.status === "IN_PROGRESS";

  return (
    <Card padding="none" className={cn("flex flex-col", muted && "opacity-70")}>
      <div className="flex-1 space-y-2.5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={CATEGORY_TONE[s.category] ?? "outline"} size="xs">
              {categoryLabel(s.category)}
            </Badge>
            {s.effort && (
              <Badge tone="outline" size="xs">
                Esfuerzo {s.effort}
              </Badge>
            )}
            {s.deliverableId && (
              <Badge tone="dark" size="xs">
                Meta creada
              </Badge>
            )}
            {s.priorityId && (
              <Badge tone="neutral" size="xs">
                En prioridades
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuDots className="-mr-2 -mt-1 shrink-0" label="Más acciones" />
            <DropdownMenuContent>
              {s.status !== "IN_PROGRESS" && s.status !== "DISMISSED" && (
                <DropdownMenuItem icon={<CircleDot />} onSelect={() => run("status", () => actions.setStatus(s, "IN_PROGRESS"))}>
                  En curso
                </DropdownMenuItem>
              )}
              {s.status !== "DONE" && s.status !== "DISMISSED" && (
                <DropdownMenuItem icon={<Check />} onSelect={() => run("status", () => actions.setStatus(s, "DONE"))}>
                  Lograda
                </DropdownMenuItem>
              )}
              {(s.status === "DONE" || s.status === "DISMISSED" || s.status === "IN_PROGRESS") && (
                <DropdownMenuItem icon={<RotateCcw />} onSelect={() => run("status", () => actions.setStatus(s, "NEW"))}>
                  Volver a nuevas
                </DropdownMenuItem>
              )}
              <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditOpen(true)}>
                Editar
              </DropdownMenuItem>
              {s.status !== "DISMISSED" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive icon={<X />} onSelect={() => run("status", () => actions.setStatus(s, "DISMISSED"))}>
                    Descartar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm font-semibold leading-snug text-ink-primary">{s.title}</p>

        {s.timing && (
          <p className="flex items-start gap-1.5 text-xs font-medium text-accent2-ink">
            <CalendarClock className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{s.timing}</span>
          </p>
        )}

        <p className="whitespace-pre-line text-xs leading-relaxed text-ink-secondary">{s.rationale}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
        {s.deliverableId ? (
          <Button asChild size="xs" variant="secondary" leftIcon={<Target className="h-3.5 w-3.5" />}>
            <Link href={`/clients/${clientId}/deliverables`}>Ver meta</Link>
          </Button>
        ) : (
          active && (
            <Button size="xs" variant="secondary" leftIcon={<Target className="h-3.5 w-3.5" />} onClick={() => setGoalOpen(true)} disabled={!!busy}>
              Convertir en meta
            </Button>
          )
        )}
        {active && !s.priorityId && (
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<ListPlus className="h-3.5 w-3.5" />}
            loading={busy === "priority"}
            disabled={!!busy && busy !== "priority"}
            onClick={() => run("priority", () => actions.toPriority(s))}
          >
            Mandar a prioridades
          </Button>
        )}
        {s.status === "NEW" && (
          <Button size="xs" variant="ghost" onClick={() => run("status", () => actions.setStatus(s, "IN_PROGRESS"))} disabled={!!busy}>
            En curso
          </Button>
        )}
        {s.status === "IN_PROGRESS" && (
          <Button size="xs" variant="ghost" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => run("status", () => actions.setStatus(s, "DONE"))} disabled={!!busy}>
            Lograda
          </Button>
        )}
        <span className="ml-auto text-2xs text-ink-muted">
          {fmtDate(s.createdAt)}
          {s.createdByName ? ` · ${s.createdByName.split(" ")[0]}` : ""}
        </span>
      </div>

      {goalOpen && (
        <ConvertToGoalModal
          suggestion={s}
          team={team}
          currentUserId={currentUserId}
          open={goalOpen}
          onOpenChange={setGoalOpen}
          onConfirm={(assigneeId) => actions.toGoal(s, assigneeId)}
        />
      )}
      {editOpen && (
        <EditSuggestionModal
          suggestion={s}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={(patch) => actions.edit(s, patch)}
        />
      )}
    </Card>
  );
}
