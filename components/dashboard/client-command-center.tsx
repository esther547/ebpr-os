"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowUpDown, Search } from "lucide-react";
import { cn, monthLabel } from "@/lib/utils";
import { ClientStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { Input } from "@/components/ui/form-field";
import { SectionHeader } from "@/components/layout/header";

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  status: ClientStatus;
  monthlyTarget: number;
  industry: string | null;
  pacing: { completed: number; inProgress: number; total: number };
  pendingApprovalCount: number;
  nextAgendaItem: {
    eventName: string;
    eventDate: Date;
    location: string | null;
  } | null;
  activeCampaign: { id: string; name: string; status: string } | null;
  strategistName: string | null;
  onboarding: { status: string } | null;
};

type Props = {
  clients: ClientRow[];
  month: number;
  year: number;
};

type SortKey = "name" | "pacing" | "approvals" | "status";

const PHASE_LABELS: Record<string, string> = {
  PREPARATION: "Prep",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Done",
};

const PHASE_TONES: Record<string, BadgeTone> = {
  PREPARATION: "info",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "neutral",
};

/** Up to two initials, for the strategist avatar. */
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function ClientCommandCenter({ clients, month, year }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "PROSPECT">("ALL");

  const filtered = clients
    .filter((c) => {
      if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "pacing") {
        const aPct = a.monthlyTarget > 0 ? a.pacing.completed / a.monthlyTarget : 0;
        const bPct = b.monthlyTarget > 0 ? b.pacing.completed / b.monthlyTarget : 0;
        return bPct - aPct; // highest pacing first
      }
      if (sort === "approvals") return b.pendingApprovalCount - a.pendingApprovalCount;
      if (sort === "status") return a.status.localeCompare(b.status);
      return 0;
    });

  const behind = clients.filter(
    (c) =>
      c.status === "ACTIVE" &&
      c.monthlyTarget > 0 &&
      c.pacing.completed / c.monthlyTarget < 0.5
  ).length;

  const activeCount = clients.filter((c) => c.status === "ACTIVE").length;

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Client Command Center"
        description={
          <>
            {monthLabel(month, year)} · {activeCount} active
            {behind > 0 && (
              <span className="font-medium text-red-600"> · {behind} behind pace</span>
            )}
          </>
        }
        className="mb-0 flex-col items-start sm:flex-row sm:items-end"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {/* Status filter — segmented control */}
            <div className="inline-flex overflow-hidden rounded-lg border border-border bg-white text-xs">
              {(["ALL", "ACTIVE", "PROSPECT"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  aria-pressed={filterStatus === s}
                  className={cn(
                    "h-8 px-3 font-medium transition-colors",
                    filterStatus === s
                      ? "bg-ink-primary text-ink-inverted"
                      : "text-ink-secondary hover:bg-surface-2"
                  )}
                >
                  {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              <Input
                type="search"
                aria-label="Search clients"
                placeholder="Search clients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        }
      />

      <Card padding="none" className="overflow-hidden">
        <div className="max-h-[560px] overflow-auto">
          <Table className="min-w-[700px]">
            <thead>
              <tr>
                <SortableTh label="Client" sortKey="name" sort={sort} onSort={setSort} />
                <Th>Strategist</Th>
                <SortableTh label="Pacing" sortKey="pacing" sort={sort} onSort={setSort} />
                <SortableTh label="Phase" sortKey="status" sort={sort} onSort={setSort} />
                <Th>Next Item</Th>
                <SortableTh
                  label="Appr."
                  sortKey="approvals"
                  sort={sort}
                  onSort={setSort}
                  align="center"
                />
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <ClientCommandRow key={client.id} client={client} />
              ))}
              {filtered.length === 0 && (
                <TableEmpty colSpan={6}>No clients match your search.</TableEmpty>
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <p className="text-right text-xs text-ink-muted">
        <span className="tabular">{filtered.length}</span> of{" "}
        <span className="tabular">{clients.length}</span> clients
      </p>
    </section>
  );
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort === sortKey;
  return (
    <Th align={align} aria-sort={active ? "ascending" : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink-primary",
          align === "center" && "justify-center",
          active && "text-ink-primary"
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
          )}
        />
      </button>
    </Th>
  );
}

function ClientCommandRow({ client }: { client: ClientRow }) {
  const router = useRouter();
  const { pacing, monthlyTarget } = client;
  const pct = monthlyTarget > 0 ? (pacing.completed / monthlyTarget) * 100 : 0;
  const inProgressPct =
    monthlyTarget > 0
      ? Math.min((pacing.inProgress / monthlyTarget) * 100, 100 - pct)
      : 0;

  const isOnTarget = pacing.completed >= monthlyTarget;
  const isOnTrack = pct >= 50 || pacing.completed + pacing.inProgress >= monthlyTarget * 0.6;
  const isBehind = !isOnTarget && !isOnTrack && client.status === "ACTIVE";

  const href = `/clients/${client.id}`;

  return (
    <tr
      onClick={() => router.push(href)}
      className="group cursor-pointer"
    >
      {/* Client name + status */}
      <Td className="max-w-[170px]">
        <div className="flex items-center gap-2">
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="truncate text-sm font-semibold text-ink-primary group-hover:underline"
          >
            {client.name}
          </Link>
          {client.status === "PROSPECT" && <Badge size="xs">Prospect</Badge>}
        </div>
        {client.industry && (
          <p className="truncate text-xs text-ink-muted">{client.industry}</p>
        )}
      </Td>

      {/* Strategist */}
      <Td>
        {client.strategistName ? (
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-secondary ring-1 ring-inset ring-border">
              {initials(client.strategistName)}
            </span>
            <span className="truncate text-xs text-ink-secondary">
              {client.strategistName.split(" ")[0]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>

      {/* Pacing bar */}
      <Td className="min-w-[150px]">
        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-[64px] flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className="flex h-full">
              <div
                className="h-full rounded-l-full bg-ink-primary transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              <div
                className="h-full bg-ink-primary/25 transition-all"
                style={{ width: `${Math.min(inProgressPct, 100)}%` }}
              />
            </div>
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular text-ink-secondary">
            {pacing.completed}/{monthlyTarget}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 text-2xs",
            isOnTarget ? "text-emerald-700" : isBehind ? "font-medium text-red-600" : "text-ink-muted"
          )}
        >
          {isOnTarget ? "On target" : isBehind ? "Behind" : "On track"}
        </p>
      </Td>

      {/* Phase */}
      <Td>
        {client.activeCampaign ? (
          <Badge tone={PHASE_TONES[client.activeCampaign.status] ?? "neutral"}>
            {PHASE_LABELS[client.activeCampaign.status] ?? client.activeCampaign.status}
          </Badge>
        ) : client.onboarding?.status === "COMPLETE" ? (
          <span className="text-xs text-ink-muted">No campaign</span>
        ) : (
          <Badge tone="outline">Onboarding</Badge>
        )}
      </Td>

      {/* Next agenda item */}
      <Td className="max-w-[150px]">
        {client.nextAgendaItem ? (
          <>
            <p className="truncate text-xs font-medium text-ink-primary">
              {client.nextAgendaItem.eventName}
            </p>
            <p className="truncate text-2xs text-ink-muted">
              {format(new Date(client.nextAgendaItem.eventDate), "MMM d")}
              {client.nextAgendaItem.location && ` · ${client.nextAgendaItem.location}`}
            </p>
          </>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>

      {/* Pending approvals */}
      <Td align="center">
        {client.pendingApprovalCount > 0 ? (
          <Badge tone="dark" size="sm" className="tabular">
            {client.pendingApprovalCount}
          </Badge>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </Td>
    </tr>
  );
}
