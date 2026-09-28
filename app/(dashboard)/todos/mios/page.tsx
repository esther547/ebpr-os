import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canManagePriorities,
  isValidDayKey,
  priorityOrderBy,
  prioritySelect,
  resolveWeekKey,
  rollOverPendingPriorities,
  weekOfInstant,
  getClientOrder,
} from "@/lib/priorities";
import { dayKeyInTz, weekStartKey } from "@/components/runners/miami-time";
import { MyTodosBoard } from "@/components/priorities/my-todos-board";

export const metadata = { title: "Mis to dos" };
export const dynamic = "force-dynamic";

/**
 * "Mis to dos": one board per strategist — every line assigned to them this week on the
 * team's Prioridades plus their own personal pending lines. Admins can open anyone's.
 */
export default async function MyTodosPage({ searchParams }: { searchParams?: { week?: string; user?: string } }) {
  const viewer = await requireUser();
  if (!canManagePriorities(viewer)) redirect(ROLE_HOME[viewer.role]);

  const team = await db.user.findMany({
    where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const targetId = viewer.role === "SUPER_ADMIN" && searchParams?.user && team.some((t) => t.id === searchParams.user) ? searchParams.user : viewer.id;
  const target = team.find((t) => t.id === targetId) ?? { id: viewer.id, name: viewer.name };

  await rollOverPendingPriorities().catch(() => undefined);
  const currentWeekKey = weekStartKey(dayKeyInTz(new Date()));
  const requested = searchParams?.week;
  const weekKey = requested && isValidDayKey(requested) ? resolveWeekKey(requested) : currentWeekKey;

  const clientOrder = await getClientOrder(weekKey);
  const rows = await db.weeklyPriority.findMany({
    where: { weekOf: weekOfInstant(weekKey), assigneeId: target.id, list: { in: ["TEAM", "PERSONAL"] } },
    select: { ...prioritySelect, list: true },
    orderBy: priorityOrderBy,
  });
  const items = rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    category: r.category,
    title: r.title,
    notes: r.notes,
    assigneeId: r.assigneeId,
    isDone: r.isDone,
    order: r.order,
    client: r.client,
    assignee: r.assignee,
    list: r.list,
  }));

  return (
    <MyTodosBoard
      items={items}
      target={target}
      team={team}
      viewerId={viewer.id}
      isAdmin={viewer.role === "SUPER_ADMIN"}
      weekKey={weekKey}
      currentWeekKey={currentWeekKey}
      clientOrder={clientOrder}
    />
  );
}
