/** Shared by server and client: the agency's relationship with a talent. */
export const TIERS = ["RETAINER", "OFF_RETAINER", "ACCESS", "UNSET"] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_LABELS: Record<Tier, string> = { RETAINER: "En retainer", OFF_RETAINER: "Fuera de retainer", ACCESS: "Acceso para brand deals", UNSET: "Sin clasificar" };
