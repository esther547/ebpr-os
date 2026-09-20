import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  interactive,
  padding = "md",
  as: Comp = "div",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article";
}) {
  return (
    <Comp
      className={cn(
        "rounded-xl border border-border bg-white shadow-card",
        interactive && "transition-all duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover",
        { none: "", sm: "p-4", md: "p-5", lg: "p-6" }[padding],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-4 flex items-center justify-between border-t border-border pt-4", className)}>{children}</div>;
}
