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
        <div className={cn("mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6", width)}>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href={homeHref} aria-label="Home" className="flex items-center">
              <EBPRLogoHorizontal size="sm" />
            </Link>
            {title && (
              <>
                <span className="h-5 w-px shrink-0 bg-border" />
                {/* Same header on the phone as on the computer: title + subtitle stay visible. */}
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold text-ink-primary">{title}</p>
                  {subtitle && <p className="truncate text-2xs text-ink-muted">{subtitle}</p>}
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {nav}
            <div className="flex items-center gap-2 border-l border-border pl-3 sm:gap-3 sm:pl-4">
              <div className="hidden text-right min-[400px]:block">
                <p className="max-w-[120px] truncate text-sm font-medium text-ink-primary sm:max-w-none">{userName}</p>
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
