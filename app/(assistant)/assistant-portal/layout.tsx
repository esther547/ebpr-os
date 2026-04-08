import { UserButton } from "@clerk/nextjs";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";

export default function AssistantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-1">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <EBPRLogoHorizontal size="sm" />
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Assistant Portal
            </span>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
