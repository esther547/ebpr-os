import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isEbmOwner, itemSelect, serializeItem, teamLeadSummary } from "@/lib/ebm-owners";
import { OPEN_STATUSES } from "@/lib/ebm-shared";
import { EbmTabs } from "@/components/ebm/ebm-tabs";
import { OwnersBoard } from "@/components/ebm/owners-board";

export const metadata = { title: "EBM — Esther & Benjy" };
export const dynamic = "force-dynamic";

export default async function EbmOwnersPage() {
  const user = await requireUser();
  if (!isEbmOwner(user)) redirect("/ebm");
  const [rows, team, members, leads] = await Promise.all([
    db.ownerItem.findMany({ select: itemSelect, orderBy: [{ updatedAt: "desc" }] }),
    teamLeadSummary(),
    db.user.findMany({ where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST", "SELLER", "ASSISTANT", "LEGAL"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.brandLead.findMany({ where: { status: { in: OPEN_STATUSES } }, select: { id: true, brand: true, owner: { select: { name: true } } }, orderBy: { brand: "asc" } }),
  ]);
  const items = rows.map(serializeItem);
  return (
    <>
      <EbmTabs current="/ebm/owners" pending={items.filter((i) => i.forWeekly).length || undefined} />
      <OwnersBoard initialItems={items} team={team} members={members} leads={leads.map((l) => ({ id: l.id, label: `${l.brand} · ${l.owner.name}` }))} currentUserId={user.id} />
    </>
  );
}
