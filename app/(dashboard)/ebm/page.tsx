import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessEbm, ebmMembers, leadSelect, type BrandLeadItem } from "@/lib/ebm";
import { EbmBoard } from "@/components/ebm/ebm-board";
import { EbmTabs } from "@/components/ebm/ebm-tabs";
import { isEbmOwner } from "@/lib/ebm-owners";

export const metadata = { title: "EBM — Brand Deals" };
export const dynamic = "force-dynamic";

export default async function EbmPage() {
  const user = await requireUser();
  if (!canAccessEbm(user)) redirect(ROLE_HOME[user.role]);

  const owner = isEbmOwner(user);
  const pending = owner ? await db.ownerItem.count({ where: { forWeekly: true } }) : 0;
  const [rows, members, clients] = await Promise.all([
    db.brandLead.findMany({ select: leadSelect, orderBy: [{ updatedAt: "desc" }] }),
    ebmMembers(),
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT", "PAUSED"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const leads: BrandLeadItem[] = rows.map((r) => ({
    ...r,
    nextFollowUpAt: r.nextFollowUpAt ? r.nextFollowUpAt.toISOString() : null,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    updates: r.updates.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  }));

  return (
    <>
      {owner && <EbmTabs current="/ebm" pending={pending || undefined} />}
      <EbmBoard initialLeads={leads} members={members.map((m) => ({ id: m.id, name: m.name }))} clients={clients} currentUserId={user.id} />
    </>
  );
}
