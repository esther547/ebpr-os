// Event logistics boards (Latin Grammys…): client-safe constants and types.
import type { BadgeTone } from "@/components/ui/badge";

export const LOGISTICS_GROUPS = { LATIN_GRAMMYS: { key: "LATIN_GRAMMYS", label: "Latin Grammys", href: "/latin-grammys" } } as const;
export type LogisticsGroupKey = keyof typeof LOGISTICS_GROUPS;

export const CLIENT_STATUSES = ["PENDING", "APPROVED", "NOT_APPROVED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = { PENDING: "Por confirmar", APPROVED: "Aprobado", NOT_APPROVED: "No aprobado" };
export const CLIENT_STATUS_TONES: Record<ClientStatus, BadgeTone> = { PENDING: "neutral", APPROVED: "success", NOT_APPROVED: "danger" };

export type EventClientRow = { id: string; client: { id: string; name: string }; status: string; pr: string | null; travelExpenses: string | null; notes: string | null };
export type EventRow = { id: string; group: string; name: string; eventDate: string | null; eventTime: string | null; venue: string | null; contact: string | null; notes: string | null; sortOrder: number; clients: EventClientRow[] };
