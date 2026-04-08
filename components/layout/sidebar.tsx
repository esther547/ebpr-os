"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Users,
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  BarChart3,
  Settings,
  Shield,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "STRATEGIST"],
  },
  {
    href: "/clients",
    label: "Clients",
    icon: <Users className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "STRATEGIST", "FINANCE"],
  },
  {
    href: "/legal",
    label: "Legal & Contracts",
    icon: <Shield className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "LEGAL", "FINANCE"],
  },
  {
    href: "/runners",
    label: "Runners",
    icon: <Calendar className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "STRATEGIST"],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: <DollarSign className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "FINANCE", "LEGAL"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["SUPER_ADMIN", "STRATEGIST", "FINANCE"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
    roles: ["SUPER_ADMIN"],
  },
];

type SidebarProps = {
  userRole: UserRole;
  userName: string;
  userEmail: string;
};

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-[220px] flex flex-col border-r border-border bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-5">
        <EBPRLogoHorizontal size="sm" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-ink-primary text-ink-inverted"
                      : "text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
                  )}
                >
                  <span
                    className={cn(
                      "flex-shrink-0",
                      isActive ? "text-ink-inverted" : "text-ink-muted"
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
      </nav>

      {/* User */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/sign-in" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-primary">
              {userName}
            </p>
            <p className="truncate text-2xs text-ink-muted">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
