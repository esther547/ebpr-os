import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonthYear } from "@/lib/utils";
import { PortalReportsClient } from "@/components/portal/portal-reports-client";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function PortalReportsPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");

  const { month, year } = currentMonthYear();

  const client = await db.client.findUnique({
    where: { id: clientUser.clientId },
    select: { id: true, name: true, monthlyTarget: true },
  });
  if (!client) redirect("/sign-in");

  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: clientUser.clientId,
      isClientVisible: true,
      month,
      year,
    },
    orderBy: { completedAt: "desc" },
  });

  return (
    <PortalReportsClient
      clientId={client.id}
      clientName={client.name}
      monthlyTarget={client.monthlyTarget}
      initialDeliverables={JSON.parse(JSON.stringify(deliverables))}
      initialMonth={month}
      initialYear={year}
    />
  );
}
