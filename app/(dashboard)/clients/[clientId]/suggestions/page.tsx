import { notFound, redirect } from "next/navigation";
import { requireUser, ROLE_HOME } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor } from "@/lib/client-availability";
import { anthropicConfigured, listSuggestions, type SuggestionRow } from "@/lib/client-suggestions";
import { SuggestionsBoard } from "@/components/suggestions/suggestions-board";
import { GenerateSuggestionsButton } from "@/components/suggestions/generate-suggestions-button";
import type { SuggestionGroups, SuggestionItem } from "@/components/suggestions/types";

type Props = { params: { clientId: string } };

export const metadata = { title: "Sugerencias" };
export const dynamic = "force-dynamic";

function toItem(r: SuggestionRow): SuggestionItem {
  return {
    id: r.id,
    title: r.title,
    rationale: r.rationale,
    category: r.category,
    effort: r.effort,
    timing: r.timing,
    status: r.status,
    batchId: r.batchId,
    deliverableId: r.deliverableId,
    priorityId: r.priorityId,
    contactNotes: r.contactNotes,
    contactSource: r.contactSource,
    contactUpdatedAt: r.contactUpdatedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? null,
  };
}

export default async function SuggestionsPage({ params }: Props) {
  const user = await requireUser();
  if (!canManageClients(user)) redirect(ROLE_HOME[user.role]);

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: {
      id: true,
      name: true,
      status: true,
      monthlyTarget: true,
      cycleDay: true,
      industry: true,
      goalsOwed: true,
      focusNote: true,
      agendaDocUrl: true,
    },
  });
  if (!client) notFound();

  const [availabilityNow, grouped, team] = await Promise.all([
    availabilityNowFor(client.id),
    listSuggestions(client.id),
    db.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const configured = anthropicConfigured();

  const groups: SuggestionGroups = {
    NEW: grouped.NEW.map(toItem),
    IN_PROGRESS: grouped.IN_PROGRESS.map(toItem),
    DONE: grouped.DONE.map(toItem),
    DISMISSED: grouped.DISMISSED.map(toItem),
  };
  const open = groups.NEW.length + groups.IN_PROGRESS.length;

  return (
    <>
      <ClientHeader
        availabilityNow={availabilityNow}
        client={client}
        counts={{ suggestions: open }}
        actions={
          configured ? <GenerateSuggestionsButton clientId={client.id} clientName={client.name} size="sm" /> : undefined
        }
      />
      <SuggestionsBoard
        clientId={client.id}
        clientName={client.name}
        groups={groups}
        team={team}
        currentUserId={user.id}
        configured={configured}
      />
    </>
  );
}
