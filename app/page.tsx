import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentClientUser } from "@/lib/auth";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "RUNNER") redirect("/runners/schedule");
    if (user.role === "LEGAL") redirect("/legal");
    if (user.role === "FINANCE") redirect("/reports");
    // Strategy team + admin → dashboard
    redirect("/dashboard");
  }

  const clientUser = await getCurrentClientUser();
  if (clientUser) redirect("/portal");

  redirect("/sign-in");
}
