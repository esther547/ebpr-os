import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "purple" | "dark" | "outline";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-secondary ring-border",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/15",
  danger: "bg-red-50 text-red-700 ring-red-600/15",
  info: "bg-blue-50 text-blue-700 ring-blue-600/15",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/15",
  dark: "bg-ink-primary text-white ring-ink-primary",
  outline: "bg-transparent text-ink-secondary ring-border-strong",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-ink-muted",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  purple: "bg-violet-500",
  dark: "bg-white",
  outline: "bg-ink-muted",
};

export function Badge({
  children,
  tone = "neutral",
  size = "sm",
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: "xs" | "sm" | "md";
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
        { xs: "px-1.5 py-0 text-2xs", sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-xs" }[size],
        tones[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

/** Map common status strings to a badge tone. */
export function statusTone(status: string | null | undefined): BadgeTone {
  switch ((status ?? "").toUpperCase()) {
    case "COMPLETED":
    case "PAID":
    case "SIGNED":
    case "ACTIVE":
    case "APPROVED":
    case "DONE":
    case "SENT":
      return "success";
    case "CONFIRMED":
    case "SCHEDULED":
    case "PENDING":
    case "PENDING_APPROVAL":
    case "PREPARATION":
    case "PROSPECT":
      return "warning";
    case "OVERDUE":
    case "CANCELLED":
    case "REJECTED":
    case "TERMINATED":
    case "EXPIRED":
    case "DECLINED":
    case "CHURNED":
    case "BLOCKED":
      return "danger";
    case "OUTREACH":
    case "IN_PROGRESS":
    case "VIEWED":
      return "info";
    case "PAUSED":
    case "ON_HOLD":
    case "REVISION_REQUESTED":
      return "purple";
    default:
      return "neutral";
  }
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
