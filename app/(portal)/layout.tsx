import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { PortalNav } from "@/components/portal/portal-nav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientUser = await getCurrentClientUser().catch(() => null);
  if (!clientUser) redirect("/sign-in");

  return (
    <PortalShell
      title={clientUser.client.name}
      subtitle="Client portal"
      nav={<PortalNav />}
      userName={clientUser.name}
      userMeta={clientUser.client.name}
      homeHref="/portal"
    >
      {children}
    </PortalShell>
  );
}
