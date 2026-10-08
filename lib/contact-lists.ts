/**
 * The "Contactos" tab holds several databases: Medios (journalists) and any number of outreach lists
 * (Music Industry today; more later). Each outreach list is a `list` value on OutreachContact.
 */
import type { SessionUser } from "./auth";
import { canManageJournalists, canManageOutreach } from "./permissions";

export type ContactDatabase = { slug: string; label: string; list: string; description: string; ownersOnly: boolean };

export const OUTREACH_DATABASES: ContactDatabase[] = [
  { slug: "industria-musical", label: "Industria musical", list: "Music Industry", description: "Managers, disqueras, promotores, venues, DSPs, marcas y agencias. Solo la ven Esther, Ana y Pao.", ownersOnly: true },
];

export function databaseBySlug(slug: string): ContactDatabase | null {
  return OUTREACH_DATABASES.find((d) => d.slug === slug) ?? null;
}
export function databaseByList(list: string): ContactDatabase | null {
  return OUTREACH_DATABASES.find((d) => d.list === list) ?? null;
}

/** Tabs the signed-in user may open under /contactos. */
export function visibleContactTabs(user: SessionUser): { href: string; label: string }[] {
  const tabs: { href: string; label: string }[] = [];
  if (canManageJournalists(user)) tabs.push({ href: "/contactos/medios", label: "Medios" });
  for (const d of OUTREACH_DATABASES) if (!d.ownersOnly || canManageOutreach(user)) tabs.push({ href: `/contactos/${d.slug}`, label: d.label });
  return tabs;
}
export function canOpenDatabase(user: SessionUser, d: ContactDatabase): boolean {
  return d.ownersOnly ? canManageOutreach(user) : canManageJournalists(user);
}
