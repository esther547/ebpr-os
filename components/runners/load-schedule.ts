import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { dayKeyInTz } from "./miami-time";
import type { ScheduleItem } from "./my-schedule-view";

/**
 * Load runner assignments shaped for MyScheduleView.
 *
 * Only display fields are selected: no clientId / deliverableId ever reach
 * the runner's browser. The client name is resolved server-side and attached
 * as plain text.
 */
export async function loadScheduleItems(
  where: Prisma.RunnerAssignmentWhereInput,
  take = 50
): Promise<ScheduleItem[]> {
  const rows = await db.runnerAssignment.findMany({
    where,
    orderBy: { eventDate: "asc" },
    take,
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      arrivalTime: true,
      eventTime: true,
      venueName: true,
      venueAddress: true,
      itemType: true,
      location: true,
      notes: true,
      status: true,
      accompanistCount: true,
      clientId: true,
      runner: { select: { id: true, name: true } },
    },
  });

  const clientIds = Array.from(
    new Set(rows.map((r) => r.clientId).filter((id): id is string => !!id))
  );
  const clients = clientIds.length
    ? await db.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    id: r.id,
    eventName: r.eventName,
    eventDate: r.eventDate.toISOString(),
    dayKey: dayKeyInTz(r.eventDate),
    arrivalTime: r.arrivalTime ? r.arrivalTime.toISOString() : null,
    eventTime: r.eventTime ? r.eventTime.toISOString() : null,
    venueName: r.venueName,
    venueAddress: r.venueAddress,
    itemType: r.itemType,
    location: r.location,
    notes: r.notes,
    status: r.status,
    accompanistCount: r.accompanistCount,
    clientName: r.clientId ? clientName.get(r.clientId) ?? null : null,
    runner: r.runner,
  }));
}
