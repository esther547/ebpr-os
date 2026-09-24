import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessPriorityList, priorityListFromSlug } from "@/lib/priorities";
import { PrioritiesBoard } from "@/components/priorities/priorities-board";

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

  return <PrioritiesBoard list={list} requestedWeek={searchParams?.week} />;
}
