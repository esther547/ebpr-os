import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentClientUser, ROLE_HOME } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);

  const clientUser = await getCurrentClientUser();
  if (clientUser) redirect("/portal");

  const { userId } = await auth();
  if (userId) redirect("/access-pending");

  redirect("/sign-in");
}
