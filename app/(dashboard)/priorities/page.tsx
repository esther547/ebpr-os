import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { PRIORITY_LISTS, canManagePriorities } from "@/lib/priorities";
import { PrioritiesBoard } from "@/components/priorities/priorities-board";

export const metadata = { title: "Prioridades" };
export const dynamic = "force-dynamic";

export default async function PrioritiesPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await requireUser();
  if (!canManagePriorities(user)) redirect(ROLE_HOME[user.role]);
  return <PrioritiesBoard list={PRIORITY_LISTS.TEAM} requestedWeek={searchParams?.week} />;
}
