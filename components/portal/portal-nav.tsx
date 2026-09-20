"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/agenda", label: "Agenda" },
  { href: "/portal/deliverables", label: "Deliverables" },
  { href: "/portal/approvals", label: "Approvals" },
  { href: "/portal/files", label: "Files" },
  { href: "/portal/reports", label: "Reports" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal" className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
      {NAV.map((item) => {
        const isActive =
          item.href === "/portal"
            ? pathname === "/portal"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "text-ink-primary bg-surface-2"
                : "text-ink-muted hover:text-ink-primary hover:bg-surface-1"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
