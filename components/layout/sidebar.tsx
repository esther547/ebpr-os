"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Users,
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Settings,
  Shield,
  Newspaper,
  BookOpen,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { NotificationBell } from "./notification-bell";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
};

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
      { href: "/clients", label: "Clients", icon: <Users />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
      { href: "/runners", label: "Runners", icon: <CalendarDays />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
    ],
  },
  {
    label: "Media",
    items: [
      { href: "/press-releases", label: "Press Releases", icon: <Newspaper />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
      { href: "/journalists", label: "Journalists", icon: <BookOpen />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/legal", label: "Legal & Contracts", icon: <Shield />, roles: ["SUPER_ADMIN", "LEGAL"] },
      { href: "/follow-up", label: "Follow-Up", icon: <ClipboardList />, roles: ["SUPER_ADMIN", "ASSISTANT", "FINANCE", "LEGAL"] },
      { href: "/reports", label: "Reports", icon: <BarChart3 />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/settings", label: "Settings", icon: <Settings />, roles: ["SUPER_ADMIN"] }],
  },
];

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Admin",
  STRATEGIST: "Strategist",
  LEGAL: "Legal",
  FINANCE: "Follow-up",
  ASSISTANT: "Assistant",
  RUNNER: "Runner",
  CLIENT_ADMIN: "Client",
  CLIENT_VIEWER: "Client",
};

type SidebarProps = {
  userRole: UserRole;
  userName: string;
  userEmail: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(userRole)) }))
    .filter((g) => g.items.length > 0);

  const nav = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <Link href="/" className="flex items-center" aria-label="EBPR OS home">
          <EBPRLogoHorizontal size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink-primary md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="eyebrow mb-1.5 px-3">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-ink-primary text-ink-inverted shadow-sm"
                          : "text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4",
                          isActive ? "text-ink-inverted" : "text-ink-muted group-hover:text-ink-primary"
                        )}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-primary text-xs font-semibold text-white">
              {initials(userName) || "?"}
            </div>
            <div className="absolute -bottom-1 -right-1 [&_.cl-userButtonTrigger]:h-5 [&_.cl-userButtonTrigger]:w-5 [&_.cl-avatarBox]:h-5 [&_.cl-avatarBox]:w-5 [&_.cl-avatarBox]:ring-2 [&_.cl-avatarBox]:ring-white">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-primary">{userName}</p>
            <p className="truncate text-2xs text-ink-muted">
              {ROLE_LABELS[userRole]} · {userEmail}
            </p>
          </div>
          <NotificationBell />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <EBPRLogoHorizontal size="sm" />
        <NotificationBell />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink-primary/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-white shadow-pop animate-slide-in-left">{nav}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-border bg-white md:flex">{nav}</aside>
    </>
  );
}
