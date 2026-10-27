// Press pitches (Prensa · Cliente · Publicista): client-safe constants and types.
import type { BadgeTone } from "@/components/ui/badge";

export const PITCH_STATUSES = ["PITCHED", "FOLLOW_UP", "REPLIED", "CONFIRMED", "DECLINED", "NO_RESPONSE"] as const;
export type PitchStatus = (typeof PITCH_STATUSES)[number];
export const PITCH_STATUS_LABELS: Record<PitchStatus, string> = { PITCHED: "Pitcheado", FOLLOW_UP: "En seguimiento", REPLIED: "Respondió", CONFIRMED: "Confirmado", DECLINED: "No le interesó", NO_RESPONSE: "Sin respuesta" };
export const PITCH_STATUS_TONES: Record<PitchStatus, BadgeTone> = { PITCHED: "info", FOLLOW_UP: "warning", REPLIED: "purple", CONFIRMED: "success", DECLINED: "danger", NO_RESPONSE: "neutral" };
/** A pitch to the same contact within this window counts as "someone already pitched them". */
export const OVERLAP_DAYS = 45;

export type PitchRow = {
  id: string; journalistId: string | null; contactName: string; outlet: string | null; client: { id: string; name: string }; pitchedBy: { id: string; name: string };
  pitchedAt: string; status: string; subject: string | null; notes: string | null; followUpAt: string | null; createdAt: string;
};
export type Overlap = { id: string; contactName: string; outlet: string | null; client: string; pitchedBy: string; pitchedAt: string; status: string };
