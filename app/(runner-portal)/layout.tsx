import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";

// External runner portal. Runners never see internal pages; admins may preview.
export default async function RunnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/access-pending");
  if (user.role !== "RUNNER" && user.role !== "SUPER_ADMIN") {
    redirect(ROLE_HOME[user.role]);
  }
  return (
    <PortalShell
      title="Runner Portal"
      subtitle="Your schedule and hours"
      userName={user.name}
      userMeta={user.role === "SUPER_ADMIN" ? "Admin preview" : "Runner"}
      homeHref="/runner-portal"
    >
      {children}
    </PortalShell>
  );
}
