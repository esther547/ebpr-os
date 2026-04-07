"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn, monthLabel } from "@/lib/utils";
import { ClientStatus } from "@prisma/client";

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

const PHASE_STYLES: Record<string, string> = {
  PREPARATION: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-surface-2 text-ink-muted",
};

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

  return (
    <div>
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink-primary">
            Client Command Center
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {monthLabel(month, year)} ·{" "}
            {clients.filter((c) => c.status === "ACTIVE").length} active
            {behind > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {behind} behind pace
              </span>
            )}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["ALL", "ACTIVE", "PROSPECT"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors",
                  filterStatus === s
                    ? "bg-ink-primary text-ink-inverted"
                    : "bg-white text-ink-secondary hover:bg-surface-2"
                )}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-ink-secondary focus:outline-none"
          >
            <option value="name">Sort: Name</option>
            <option value="pacing">Sort: Pacing</option>
            <option value="approvals">Sort: Approvals</option>
            <option value="status">Sort: Status</option>
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-ink-primary w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1.5fr_80px] border-b border-border bg-surface-1 px-4 py-2.5">
          {["Client", "Strategist", `Pacing (${monthLabel(month, year)})`, "Phase", "Next Item", "Appr."].map((h) => (
            <div
              key={h}
              className="text-2xs font-semibold uppercase tracking-wider text-ink-muted"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {filtered.map((client) => (
            <ClientCommandRow key={client.id} client={client} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-ink-muted">
            No clients match your search.
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-muted text-right">
        {filtered.length} of {clients.length} clients
      </p>
    </div>
  );
}

function ClientCommandRow({ client }: { client: ClientRow }) {
  const { pacing, monthlyTarget } = client;
  const pct = monthlyTarget > 0 ? (pacing.completed / monthlyTarget) * 100 : 0;
  const inProgressPct =
    monthlyTarget > 0
      ? Math.min((pacing.inProgress / monthlyTarget) * 100, 100 - pct)
      : 0;

  const isOnTarget = pacing.completed >= monthlyTarget;
  const isOnTrack = pct >= 50 || pacing.completed + pacing.inProgress >= monthlyTarget * 0.6;
  const isBehind = !isOnTarget && !isOnTrack && client.status === "ACTIVE";

  return (
    <Link
      href={`/clients/${client.id}`}
      className="grid grid-cols-[2fr_1fr_2fr_1fr_1.5fr_80px] px-4 py-3.5 hover:bg-surface-1 transition-colors items-center group"
    >
      {/* Client name + status */}
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-ink-primary truncate group-hover:underline">
            {client.name}
          </p>
          {client.status === "PROSPECT" && (
            <span className="flex-shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-muted">
              Prospect
            </span>
          )}
        </div>
        {client.industry && (
          <p className="text-xs text-ink-muted truncate">{client.industry}</p>
        )}
      </div>

      {/* Strategist */}
      <div className="pr-4">
        {client.strategistName ? (
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 flex-shrink-0 rounded-full bg-surface-3 flex items-center justify-center text-2xs font-bold text-ink-secondary">
              {client.strategistName[0].toUpperCase()}
            </div>
            <span className="text-xs text-ink-secondary truncate">
              {client.strategistName.split(" ")[0]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>

      {/* Pacing bar */}
      <div className="pr-4">
        <div className="flex items-center gap-2">
          {/* Bar */}
          <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden min-w-[60px]">
            <div
              className="h-full float-left bg-ink-primary transition-all rounded-l-full"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
            <div
              className="h-full float-left bg-ink-primary/25 transition-all"
              style={{ width: `${Math.min(inProgressPct, 100)}%` }}
            />
          </div>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums flex-shrink-0 w-10 text-right",
              isOnTarget ? "text-green-700" : isBehind ? "text-red-600" : "text-ink-secondary"
            )}
          >
            {pacing.completed}/{monthlyTarget}
          </span>
        </div>
        <p
          className={cn(
            "text-2xs mt-0.5",
            isOnTarget ? "text-green-700" : isBehind ? "text-red-600 font-medium" : "text-ink-muted"
          )}
        >
          {isOnTarget ? "On target" : isBehind ? "Behind" : "On track"}
        </p>
      </div>

      {/* Phase */}
      <div className="pr-4">
        {client.activeCampaign ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-2xs font-semibold",
              PHASE_STYLES[client.activeCampaign.status] ?? "bg-surface-2 text-ink-muted"
            )}
          >
            {PHASE_LABELS[client.activeCampaign.status] ?? client.activeCampaign.status}
          </span>
        ) : client.onboarding?.status === "COMPLETE" ? (
          <span className="text-xs text-ink-muted">No campaign</span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-muted">
            Onboarding
          </span>
        )}
      </div>

      {/* Next agenda item */}
      <div className="pr-2 min-w-0">
        {client.nextAgendaItem ? (
          <div>
            <p className="text-xs font-medium text-ink-primary truncate">
              {client.nextAgendaItem.eventName}
            </p>
            <p className="text-2xs text-ink-muted">
              {format(new Date(client.nextAgendaItem.eventDate), "MMM d")}
              {client.nextAgendaItem.location && ` · ${client.nextAgendaItem.location}`}
            </p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>

      {/* Pending approvals */}
      <div className="flex justify-center">
        {client.pendingApprovalCount > 0 ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-primary text-xs font-bold text-ink-inverted">
            {client.pendingApprovalCount}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>
    </Link>
  );
}
