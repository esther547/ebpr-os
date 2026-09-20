"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex h-9 items-center gap-1 rounded-lg bg-surface-2 p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-secondary transition-all",
        "hover:text-ink-primary data-[state=active]:bg-white data-[state=active]:text-ink-primary data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-4 focus-visible:outline-none", className)} {...props} />;
}

/** Link-style tabs for sub-navigation (client pages). */
export function NavTabs({
  items,
  current,
  className,
}: {
  items: { href: string; label: string; count?: number }[];
  current: string;
  className?: string;
}) {
  return (
    <nav className={cn("no-scrollbar -mb-px flex gap-1 overflow-x-auto border-b border-border", className)}>
      {items.map((item) => {
        const active = current === item.href || current.startsWith(item.href + "/");
        return (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-ink-primary text-ink-primary"
                : "border-transparent text-ink-muted hover:border-border-strong hover:text-ink-primary"
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("rounded-full px-1.5 text-2xs tabular", active ? "bg-ink-primary text-white" : "bg-surface-2 text-ink-muted")}>
                {item.count}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
