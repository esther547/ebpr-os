import Link from "next/link";
import { db } from "@/lib/db";
import { addDaysKey, dayKeyInTz, formatDayKey, tzMidnight } from "@/components/runners/miami-time";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ArrowRight, FileSignature, CalendarClock } from "lucide-react";

type Props = {
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
  /** Legal/finance links only make sense for roles that can open them. */
  canOpenLegalFinance: boolean;
};

const MAX_ITEMS = 5;

/**
 * Server component: agency-wide alerts for the dashboard.
 * - Contracts sent but not signed (missing signatures)
 * - Deliverables due within the next 7 days that are not done
 */
export async function DashboardAlerts({ todayKey, canOpenLegalFinance }: Props) {
  const todayStart = tzMidnight(todayKey);
  const weekAhead = tzMidnight(addDaysKey(todayKey, 8)); // exclusive

  const [unsignedContracts, upcomingDeliverables] = await Promise.all([
    db.contract.findMany({
      where: {
        status: "SENT",
        signatures: { none: { status: "SIGNED" } },
      },
      select: {
        id: true,
        title: true,
        sentAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: "asc" },
      take: MAX_ITEMS + 1,
    }),
    db.deliverable.findMany({
      where: {
        dueDate: { gte: todayStart, lt: weekAhead },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: MAX_ITEMS + 1,
    }),
  ]);

  const sections: {
    key: string;
    label: string;
    href: string | null;
    tone: BadgeTone;
    icon: React.ReactNode;
    items: { id: string; primary: string; secondary: string; meta: string; href: string }[];
  }[] = [
    {
      key: "signatures",
      label: "Missing signatures",
      href: canOpenLegalFinance ? "/legal" : null,
      tone: "warning",
      icon: <FileSignature className="h-3.5 w-3.5" />,
      items: unsignedContracts.map((c) => ({
        id: c.id,
        primary: c.client.name,
        secondary: c.title,
        meta: c.sentAt ? `sent ${formatDayKey(dayKeyInTz(c.sentAt), "MMM d")}` : "not sent",
        href: `/clients/${c.client.id}`,
      })),
    },
    {
      key: "deliverables",
      label: "Due this week",
      href: null,
      tone: "info",
      icon: <CalendarClock className="h-3.5 w-3.5" />,
      items: upcomingDeliverables.map((d) => ({
        id: d.id,
        primary: d.client.name,
        secondary: d.title,
        meta: d.dueDate ? formatDayKey(dayKeyInTz(d.dueDate), "EEE d") : "",
        href: `/clients/${d.client.id}/deliverables`,
      })),
    },
  ];

  if (sections.every((s) => s.items.length === 0)) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sections.map((section) => {
        const count = section.items.length;
        return (
          <Card key={section.key} padding="sm" className="flex flex-col">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow truncate">{section.label}</p>
              <Badge tone={count > 0 ? section.tone : "neutral"} dot>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-ink-muted [&>svg]:h-3.5 [&>svg]:w-3.5">{section.icon}</span>
                  <span className="tabular">{count > MAX_ITEMS ? `${MAX_ITEMS}+` : count}</span>
                </span>
              </Badge>
            </div>

            {count === 0 ? (
              <p className="text-sm text-ink-muted">All clear</p>
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {section.items.slice(0, MAX_ITEMS).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-1"
                    >
                      <p className="truncate text-sm font-medium text-ink-primary">{item.primary}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {item.secondary}
                        {item.meta && ` \u00b7 ${item.meta}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {section.href && count > 0 && (
              <Link
                href={section.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink-primary"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </Card>
        );
      })}
    </div>
  );
}
