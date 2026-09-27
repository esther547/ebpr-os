// EBM (EB Management) brand-deal tracker: who may open it and who can own a lead.
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export { LEAD_STATUSES, LEAD_STATUS_LABELS, OPEN_STATUSES, isLeadStatus, leadSelect } from "@/lib/ebm-shared";
export type { BrandLeadItem, LeadStatus, LeadUpdateItem } from "@/lib/ebm-shared";

/** EBPR people who also work EB Management (Esther, Sept 27 2026). Sellers get in by role. */
export const EBM_TEAM_EMAILS = [
  "esther@ebmanagement.io",
  "carolina@ebmanagement.io",
  "ayax@ebmanagement.io",
];

export function canAccessEbm(user: SessionUser): boolean {
  if (user.role === "SELLER" || user.role === "SUPER_ADMIN") return true;
  return EBM_TEAM_EMAILS.includes((user.email ?? "").toLowerCase());
}

/** Everyone who can own a lead: active sellers plus the EBPR people on the EBM team. */
export async function ebmMembers(): Promise<{ id: string; name: string; email: string }[]> {
  return db.user.findMany({
    where: { isActive: true, OR: [{ role: "SELLER" }, { email: { in: EBM_TEAM_EMAILS, mode: "insensitive" } }] },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
