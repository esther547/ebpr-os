"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Users,
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  BarChart3,
  Settings,
  Shield,
  Newspaper,
  BookOpen,
  ClipboardList,
  ListChecks,
  Trophy,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { NotificationBell } from "./notification-bell";
import type { UserRole } from "@prisma/client";
import { FEATURES } from "@/lib/features";

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
      { href: "/priorities", label: "Prioridades", icon: <ListChecks />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
      { href: "/events", label: "Calendario de eventos", icon: <CalendarRange />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
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
      { href: "/reports/strategists", label: "Metas por estratega", icon: <Trophy />, roles: ["SUPER_ADMIN", "STRATEGIST"] },
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
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(userRole) && (FEATURES.legal || !["/legal", "/follow-up"].includes(i.href))) }))
    .filter((g) => g.items.length > 0);

  // Most specific match wins, so /reports/strategists does not also light up /reports.
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const isActiveHref = (href: string) =>
    matches(href) && !allHrefs.some((h) => h !== href && h.startsWith(href + "/") && matches(h));

  const nav = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Link href="/" className="flex items-center" aria-label="EBPR OS home">
          <EBPRLogoHorizontal size="sm" inverted />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.14em] text-white/35">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isActiveHref(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-ink-primary shadow-sm"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span
                        className={cn(
                          "flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4",
                          isActive ? "text-accent2" : "text-white/40 group-hover:text-white"
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

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent2 text-xs font-semibold text-white">
              {initials(userName) || "?"}
            </div>
            <div className="absolute -bottom-1 -right-1 [&_.cl-userButtonTrigger]:h-5 [&_.cl-userButtonTrigger]:w-5 [&_.cl-avatarBox]:h-5 [&_.cl-avatarBox]:w-5 [&_.cl-avatarBox]:ring-2 [&_.cl-avatarBox]:ring-white">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-2xs text-white/50">
              {ROLE_LABELS[userRole]} · {userEmail}
            </p>
          </div>
          <span className="[&_button]:text-white/60 [&_button:hover]:bg-white/10 [&_button:hover]:text-white"><NotificationBell /></span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ink-primary px-4 text-white md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <EBPRLogoHorizontal size="sm" inverted />
        <span className="[&_button]:text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white"><NotificationBell /></span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink-primary/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-ink-primary shadow-pop animate-slide-in-left">{nav}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col bg-ink-primary text-white md:flex">{nav}</aside>
    </>
  );
}
