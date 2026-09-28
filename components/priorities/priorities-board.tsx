// Server-side loader shared by /priorities (team board) and /todos/[list]
// (personal boards). Access is checked by the caller; this only loads data.
import { db } from "@/lib/db";
import {
  isValidDayKey,
  priorityOrderBy,
  prioritySelect,
  resolveWeekKey,
  rollOverPendingPriorities,
  weekOfInstant,
  getClientOrder,
  type PriorityList,
} from "@/lib/priorities";
import { dayKeyInTz, weekStartKey } from "@/components/runners/miami-time";
import { PrioritiesPageClient } from "./priorities-page-client";
import type { ClientOption } from "./helpers";

export async function PrioritiesBoard({
  list,
  requestedWeek,
  canReorder = false,
}: {
  list: PriorityList;
  requestedWeek?: string;
  /** Team board: the viewer may reorder clients by urgency (admin). */
  canReorder?: boolean;
}) {
  // Week boundaries in Miami time (weeks start Monday), independent of server TZ.
  const currentWeekKey = weekStartKey(dayKeyInTz(new Date()));
  const weekKey =
    requestedWeek && isValidDayKey(requestedWeek) ? resolveWeekKey(requestedWeek) : currentWeekKey;
  // Pending lines from past weeks follow the team into the current week.
  await rollOverPendingPriorities().catch((err) => console.error("rollOverPendingPriorities failed:", err));

  const [rows, activeClients, teamMembers, clientOrder] = await Promise.all([
    db.weeklyPriority.findMany({
      where: { weekOf: weekOfInstant(weekKey), list: list.key },
      select: prioritySelect,
      orderBy: priorityOrderBy,
    }),
    db.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    list.personal
      ? Promise.resolve([])
      : db.user.findMany({
          // Email-locked boards assign only among their viewers; the team board among admins + strategists.
          where: list.viewers.length
            ? { isActive: true, email: { in: list.viewers, mode: "insensitive" } }
            : { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
    list.key === "TEAM" ? getClientOrder(weekKey) : Promise.resolve([] as string[]),
  ]);

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
  }));

  // Active clients, plus any other client that already has a line this week.
  const clients: ClientOption[] = [...activeClients];
  const known = new Set(clients.map((c) => c.id));
  for (const item of items) {
    if (item.client && !known.has(item.client.id)) {
      known.add(item.client.id);
      clients.push(item.client);
    }
  }
  clients.sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <PrioritiesPageClient
      board={{ key: list.key, path: list.path, title: list.title, subtitle: list.subtitle, personal: list.personal, categories: list.categories ? [...list.categories] : undefined }}
      initialItems={items}
      clients={clients}
      teamMembers={teamMembers}
      weekKey={weekKey}
      currentWeekKey={currentWeekKey}
      clientOrder={clientOrder}
      canReorder={canReorder && list.key === "TEAM"}
    />
  );
}
