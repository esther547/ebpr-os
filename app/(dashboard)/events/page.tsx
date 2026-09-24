import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageEvents, upcomingEvents } from "@/lib/industry-events";
import {
  currentMonthYearInTz,
  dayKeyInTz,
  monthBounds,
} from "@/components/runners/miami-time";
import { EventsPageClient } from "@/components/events/events-page-client";

export const metadata = { title: "Calendario de eventos" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requireUser();
  if (!canManageEvents(user)) redirect("/dashboard");

  const now = new Date();
  const { year, month } = currentMonthYearInTz(now);

  const [items, remindersThisMonth] = await Promise.all([
    upcomingEvents(365, now),
    db.industryEventReminder.count({ where: { sentAt: monthBounds(year, month) } }),
  ]);

  return (
    <EventsPageClient
      items={items}
      todayKey={dayKeyInTz(now)}
      remindersThisMonth={remindersThisMonth}
    />
  );
}
