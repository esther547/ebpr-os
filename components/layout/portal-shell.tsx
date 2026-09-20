import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { cn } from "@/lib/utils";

/**
 * Minimal chrome for external portals (runners, assistant, clients).
 * No internal navigation is ever rendered here.
 */
export function PortalShell({
  children,
  title,
  subtitle,
  nav,
  userName,
  userMeta,
  homeHref = "/",
  width = "max-w-5xl",
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  nav?: React.ReactNode;
  userName: string;
  userMeta?: string;
  homeHref?: string;
  width?: string;
}) {
  return (
    <div className="min-h-screen bg-surface-1">
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className={cn("mx-auto flex h-16 items-center justify-between gap-6 px-4 sm:px-6", width)}>
          <div className="flex items-center gap-4">
            <Link href={homeHref} aria-label="Home" className="flex items-center">
              <EBPRLogoHorizontal size="sm" />
            </Link>
            {title && (
              <>
                <span className="hidden h-5 w-px bg-border sm:block" />
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-semibold text-ink-primary">{title}</p>
                  {subtitle && <p className="text-2xs text-ink-muted">{subtitle}</p>}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {nav}
            <div className="flex items-center gap-3 border-l border-border pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-ink-primary">{userName}</p>
                {userMeta && <p className="text-2xs text-ink-muted">{userMeta}</p>}
              </div>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>
      </header>
      <main className={cn("page-enter mx-auto px-4 py-8 sm:px-6 sm:py-10", width)}>{children}</main>
    </div>
  );
}
