// Serializable shapes the Sugerencias page passes to its client components.

import type { SuggestionStatusValue } from "@/lib/client-suggestions-format";

export type SuggestionItem = {
  id: string;
  title: string;
  rationale: string;
  category: string;
  effort: string | null;
  timing: string | null;
  status: SuggestionStatusValue;
  batchId: string;
  deliverableId: string | null;
  priorityId: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type SuggestionGroups = Record<SuggestionStatusValue, SuggestionItem[]>;

export type TeamMember = { id: string; name: string };

/** Window event the header button fires so the board can show the loading card. */
export const GENERATING_EVENT = "ebpr:suggestions-generating";
export type GeneratingDetail = { active: boolean; clientName: string };
