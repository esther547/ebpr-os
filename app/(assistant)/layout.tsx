import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";

// Assistant portal (Carolina). Client names only — never amounts.
export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/access-pending");
  if (user.role !== "ASSISTANT" && user.role !== "SUPER_ADMIN") {
    redirect(ROLE_HOME[user.role]);
  }
  return (
    <PortalShell
      title="Follow-Ups"
      subtitle="Payments and signatures to chase"
      userName={user.name}
      userMeta={user.role === "SUPER_ADMIN" ? "Admin preview" : "Assistant"}
      homeHref="/follow-up"
    >
      {children}
    </PortalShell>
  );
}
