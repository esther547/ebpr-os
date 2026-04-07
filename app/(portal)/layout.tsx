import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { UserButton } from "@clerk/nextjs";
import { PortalNav } from "@/components/portal/portal-nav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientUser = await getCurrentClientUser().catch(() => null);
  if (!clientUser) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-surface-1">
      {/* Portal top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <EBPRLogoHorizontal size="sm" />

          <div className="flex items-center gap-6">
            <PortalNav />
            <div className="flex items-center gap-3 border-l border-border pl-6">
              <div className="text-right">
                <p className="text-sm font-medium text-ink-primary">
                  {clientUser.client.name}
                </p>
                <p className="text-xs text-ink-muted">{clientUser.name}</p>
              </div>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
