import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}) {
  const hintColor = {
    neutral: "text-ink-muted",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-600",
  }[tone];
  return (
    <div className={cn("rounded-xl border border-border bg-white p-5 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {icon && <span className="text-ink-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink-primary tabular">{value}</p>
      {hint && <p className={cn("mt-1 text-xs", hintColor)}>{hint}</p>}
    </div>
  );
}
