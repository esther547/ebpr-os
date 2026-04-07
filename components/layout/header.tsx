"use client";

import { cn } from "@/lib/utils";

type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: HeaderProps) {
  return (
    <div className={cn("flex items-start justify-between py-6", className)}>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-ink-secondary">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
