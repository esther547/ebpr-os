// EBM owners' private tracker (Esther & Benjy): client-safe constants and types.

export const OWNER_EMAILS = ["esther@ebmanagement.io", "benjy@ebmanagement.io"];

export const ITEM_CATEGORIES = ["TEAM", "CAMPAIGN", "LEGAL", "LEAD", "OTHER"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ItemCategory, string> = { TEAM: "Team", CAMPAIGN: "Campaign", LEGAL: "Legal", LEAD: "Lead / brand", OTHER: "Other" };

export const ITEM_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_LEGAL", "WAITING_BRAND", "WAITING_TALENT", "WAITING_TEAM", "DONE"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const STATUS_LABELS: Record<ItemStatus, string> = { OPEN: "Open", IN_PROGRESS: "In progress", WAITING_LEGAL: "Waiting on legal", WAITING_BRAND: "Waiting on brand", WAITING_TALENT: "Waiting on talent", WAITING_TEAM: "Waiting on team", DONE: "Done" };
export const OPEN_ITEM_STATUSES: ItemStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_LEGAL", "WAITING_BRAND", "WAITING_TALENT", "WAITING_TEAM"];

export type ItemUpdate = { id: string; text: string; status: string | null; createdAt: string; author: { id: string; name: string } };
export type OwnerItemRow = {
  id: string; title: string; category: string; status: string; waitingOn: string | null; nextStep: string | null; dueAt: string | null; notes: string | null; forWeekly: boolean;
  handler: { id: string; name: string } | null; lead: { id: string; brand: string; status: string; owner: { name: string } } | null; createdBy: { name: string }; resolvedAt: string | null; createdAt: string; updatedAt: string; updates: ItemUpdate[];
};
export type TeamLeadSummary = { ownerId: string; ownerName: string; open: number; overdue: number; stale: number; won: number; lastUpdate: string | null };
