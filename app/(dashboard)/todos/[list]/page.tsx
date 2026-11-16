import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessPriorityList, getClientOrder, isValidDayKey, priorityListFromSlug, priorityOrderBy, prioritySelect, resolveWeekKey, weekOfInstant } from "@/lib/priorities";
import { db } from "@/lib/db";
import { canRunTimer, canViewTimesheet, timeEntrySelect, timesheetOwner, toDTO } from "@/lib/time-tracking";
import { TimeTracker } from "@/components/time/time-tracker";
import { addDaysKey, dayKeyInTz, tzMidnight, weekStartKey } from "@/components/runners/miami-time";
import { PrioritiesBoard } from "@/components/priorities/priorities-board";
import { AssignedTeamCard } from "@/components/priorities/assigned-team-card";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { list: string } }) {
  const list = priorityListFromSlug(params.list);
  return { title: list?.title ?? "To dos" };
}

/** Personal to-do boards (/todos/esther, /todos/carolina): locked by email, never by role. */
export default async function PersonalTodosPage({
  params,
  searchParams,
}: {
  params: { list: string };
  searchParams?: { week?: string };
}) {
  const list = priorityListFromSlug(params.list);
  if (!list) notFound();

  const user = await requireUser();
  // Someone who may not open this board is sent to a board they may (or to their home).
  if (!canAccessPriorityList(user, list.key)) redirect("/todos");

  // Carolina's board carries her hourly time tracker (Clockify-style); Esther sees it read-only.
  if (list.key === "CAROLINA" && canViewTimesheet(user)) {
    const owner = await timesheetOwner();
    if (owner) {
      const requested = searchParams?.week;
      const weekKey = requested && isValidDayKey(requested) ? resolveWeekKey(requested) : weekStartKey(dayKeyInTz(new Date()));
      const [entries, todos] = await Promise.all([
        db.timeEntry.findMany({
          where: { userId: owner.id, OR: [{ startedAt: { gte: tzMidnight(weekKey), lt: tzMidnight(addDaysKey(weekKey, 7)) } }, { endedAt: null }] },
          select: timeEntrySelect,
          orderBy: { startedAt: "asc" },
        }),
        db.weeklyPriority.findMany({ where: { list: "CAROLINA", weekOf: weekOfInstant(weekKey), isDone: false }, select: { title: true }, take: 100 }),
      ]);
      return (
        <PrioritiesBoard
          list={list}
          requestedWeek={searchParams?.week}
          topSlot={
            <TimeTracker
              initialEntries={entries.map(toDTO)}
              weekKey={weekKey}
              canRun={canRunTimer(user)}
              ownerName={owner.name}
              todoTitles={Array.from(new Set(todos.map((t) => t.title)))}
              serverNow={Date.now()}
            />
          }
        />
      );
    }
  }

  // Esther: "Mis to dos" lives inside her board — the lines assigned to her on Prioridades sit on top.
  if (list.key === "ESTHER") {
    const requested = searchParams?.week;
    const weekKey = requested && isValidDayKey(requested) ? resolveWeekKey(requested) : weekStartKey(dayKeyInTz(new Date()));
    const [rows, clientOrder, team] = await Promise.all([
      db.weeklyPriority.findMany({ where: { weekOf: weekOfInstant(weekKey), assigneeId: user.id, list: "TEAM" }, select: prioritySelect, orderBy: priorityOrderBy }),
      getClientOrder(weekKey),
      user.role === "SUPER_ADMIN" ? db.user.findMany({ where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    ]);
    const assigned = rows.map((r) => ({ id: r.id, clientId: r.clientId, category: r.category, title: r.title, notes: r.notes, assigneeId: r.assigneeId, isDone: r.isDone, order: r.order, client: r.client, assignee: r.assignee }));
    return <PrioritiesBoard list={list} requestedWeek={searchParams?.week} topSlot={<AssignedTeamCard items={assigned} ownerId={user.id} weekKey={weekKey} clientOrder={clientOrder} team={team} />} />;
  }

  return <PrioritiesBoard list={list} requestedWeek={searchParams?.week} />;
}
