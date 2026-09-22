import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canManagePriorities,
  isValidDayKey,
  priorityOrderBy,
  prioritySelect,
  resolveWeekKey,
  weekOfInstant,
} from "@/lib/priorities";
import { dayKeyInTz, weekStartKey } from "@/components/runners/miami-time";
import { PrioritiesPageClient } from "@/components/priorities/priorities-page-client";
import type { ClientOption } from "@/components/priorities/helpers";

export const metadata = { title: "Prioridades" };
export const dynamic = "force-dynamic";

export default async function PrioritiesPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await requireUser();
  if (!canManagePriorities(user)) redirect(ROLE_HOME[user.role]);

  // Week boundaries in Miami time (weeks start Monday), independent of server TZ.
  const currentWeekKey = weekStartKey(dayKeyInTz(new Date()));
  const requested = searchParams?.week;
  const weekKey =
    requested && isValidDayKey(requested) ? resolveWeekKey(requested) : currentWeekKey;

  const [rows, activeClients, teamMembers] = await Promise.all([
    db.weeklyPriority.findMany({
      where: { weekOf: weekOfInstant(weekKey) },
      select: prioritySelect,
      orderBy: priorityOrderBy,
    }),
    db.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
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
      initialItems={items}
      clients={clients}
      teamMembers={teamMembers}
      weekKey={weekKey}
      currentWeekKey={currentWeekKey}
    />
  );
}
