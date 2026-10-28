import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseLogistics, eventSelect, serializeEvent, LOGISTICS_GROUPS } from "@/lib/logistics";
import { LogisticsBoard } from "@/components/logistics/logistics-board";

export const metadata = { title: "Latin Grammys" };
export const dynamic = "force-dynamic";

export default async function LatinGrammysPage() {
  const user = await requireUser();
  if (!canUseLogistics(user)) redirect(ROLE_HOME[user.role]);
  const g = LOGISTICS_GROUPS.LATIN_GRAMMYS;
  const [rows, clients] = await Promise.all([
    db.logisticsEvent.findMany({ where: { group: g.key }, select: eventSelect, orderBy: [{ eventDate: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT", "PAUSED"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <LogisticsBoard group={g.key} title={g.label} initialEvents={rows.map(serializeEvent)} clients={clients} />;
}
