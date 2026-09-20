import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonthYear } from "@/lib/utils";
import { PortalReportsClient } from "@/components/portal/portal-reports-client";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function PortalReportsPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");
  if (!clientUser.isActive) redirect("/access-pending");

  const current = currentMonthYear();

  // Month navigation is server-rendered from the URL, so the portal never needs an internal API.
  let month = parseInt(searchParams.month ?? "", 10);
  let year = parseInt(searchParams.year ?? "", 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) month = current.month;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) year = current.year;
  // Never show a future month
  if (year > current.year || (year === current.year && month > current.month)) {
    month = current.month;
    year = current.year;
  }

  const client = await db.client.findUnique({
    where: { id: clientUser.clientId },
    select: { id: true, name: true, monthlyTarget: true },
  });
  if (!client) redirect("/sign-in");

  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: clientUser.clientId,
      isClientVisible: true,
      isInternal: false,
      month,
      year,
    },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      outcome: true,
      completedAt: true,
    },
  });

  return (
    <PortalReportsClient
      clientName={client.name}
      monthlyTarget={client.monthlyTarget}
      deliverables={deliverables.map((d) => ({
        ...d,
        completedAt: d.completedAt ? d.completedAt.toISOString() : null,
      }))}
      month={month}
      year={year}
      currentMonth={current.month}
      currentYear={current.year}
    />
  );
}
