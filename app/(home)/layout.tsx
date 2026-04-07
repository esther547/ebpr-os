import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Full-screen layout — no sidebar. Dashboard is its own world.
export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/sign-in");
  return <>{children}</>;
}
