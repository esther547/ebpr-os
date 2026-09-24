import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { personalListsFor } from "@/lib/priorities";

export const dynamic = "force-dynamic";

/** /todos → the first personal board this user may open; otherwise their normal landing page. */
export default async function TodosIndexPage() {
  const user = await requireUser();
  const [first] = personalListsFor(user);
  if (first) redirect(first.path);
  redirect(user.role === "SUPER_ADMIN" || user.role === "STRATEGIST" ? "/dashboard" : "/paused");
}
