"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align="end"
        className={cn(
          "z-[60] min-w-[180px] overflow-hidden rounded-xl border border-border bg-white p-1 shadow-pop",
          "data-[state=open]:animate-fade-in",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  icon,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean; icon?: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive ? "text-red-600 data-[highlighted]:bg-red-50" : "text-ink-primary",
        className
      )}
      {...props}
    >
      {icon && <span className="text-ink-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <DropdownMenuPrimitive.Separator className={cn("my-1 h-px bg-border", className)} />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn("px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-muted", className)} {...props} />;
}

/** Ready-made "⋯" trigger button. */
export function DropdownMenuDots({ className, label = "Actions" }: { className?: string; label?: string }) {
  return (
    <DropdownMenuPrimitive.Trigger asChild>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors",
          "hover:bg-surface-2 hover:text-ink-primary data-[state=open]:bg-surface-2 data-[state=open]:text-ink-primary",
          className
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuPrimitive.Trigger>
  );
}
