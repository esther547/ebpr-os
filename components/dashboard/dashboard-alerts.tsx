import Link from "next/link";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { addDaysKey, dayKeyInTz, formatDayKey, tzMidnight } from "@/components/runners/miami-time";

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
 * - Overdue invoices (status OVERDUE, or SENT past its due date)
 * - Deliverables due within the next 7 days that are not done
 */
export async function DashboardAlerts({ todayKey, canOpenLegalFinance }: Props) {
  const todayStart = tzMidnight(todayKey);
  const weekAhead = tzMidnight(addDaysKey(todayKey, 8)); // exclusive

  const [unsignedContracts, overdueInvoices, upcomingDeliverables] = await Promise.all([
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
    db.invoice.findMany({
      where: {
        OR: [
          { status: "OVERDUE" },
          { status: "SENT", dueDate: { lt: todayStart } },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        dueDate: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
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

  const sections = [
    {
      key: "signatures",
      label: "Missing signatures",
      href: canOpenLegalFinance ? "/legal" : null,
      items: unsignedContracts.map((c) => ({
        id: c.id,
        primary: c.client.name,
        secondary: c.title,
        meta: c.sentAt ? `sent ${formatDayKey(dayKeyInTz(c.sentAt), "MMM d")}` : "not sent",
        href: `/clients/${c.client.id}`,
      })),
    },
    {
      key: "payments",
      label: "Overdue payments",
      href: canOpenLegalFinance ? "/finance" : null,
      items: overdueInvoices.map((i) => ({
        id: i.id,
        primary: i.client.name,
        secondary: `${i.invoiceNumber} · ${formatCurrency(Number(i.amount))}`,
        meta: i.dueDate ? `due ${formatDayKey(dayKeyInTz(i.dueDate), "MMM d")}` : "no due date",
        href: `/clients/${i.client.id}`,
      })),
    },
    {
      key: "deliverables",
      label: "Due this week",
      href: null,
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
    <div className="mt-6 grid grid-cols-3 gap-4">
      {sections.map((section) => (
        <div
          key={section.key}
          className={
            section.items.length > 0
              ? "rounded-lg border border-amber-200 bg-amber-50/40 p-4"
              : "rounded-lg border border-border bg-white p-4"
          }
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {section.label}
            </p>
            <span className="text-xs font-bold tabular-nums text-ink-primary">
              {section.items.length > MAX_ITEMS ? `${MAX_ITEMS}+` : section.items.length}
            </span>
          </div>
          {section.items.length === 0 ? (
            <p className="text-xs text-ink-muted">All clear</p>
          ) : (
            <ul className="space-y-1">
              {section.items.slice(0, MAX_ITEMS).map((item) => (
                <li key={item.id} className="text-xs leading-snug">
                  <Link href={item.href} className="hover:underline">
                    <span className="font-medium text-ink-primary">{item.primary}</span>
                    <span className="text-ink-secondary"> · {item.secondary}</span>
                  </Link>
                  {item.meta && <span className="text-ink-muted"> · {item.meta}</span>}
                </li>
              ))}
              {section.href && (
                <li className="pt-1">
                  <Link href={section.href} className="text-2xs font-medium text-ink-muted hover:text-ink-primary">
                    View all →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
