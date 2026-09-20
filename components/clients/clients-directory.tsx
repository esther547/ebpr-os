"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Input, Select, Button } from "@/components/ui/form-field";
import { SectionHeader } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientCard, type ClientCardData } from "./client-card";

const FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PROSPECT", label: "Prospects" },
  { value: "PAUSED", label: "Paused" },
  { value: "CHURNED", label: "Churned" },
];

export function ClientsDirectory({ clients }: { clients: ClientCardData[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (status !== "ALL" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q)
      );
    });
  }, [clients, query, status]);

  const active = filtered.filter((c) => c.status === "ACTIVE");
  const prospects = filtered.filter((c) => c.status === "PROSPECT");
  const inactive = filtered.filter((c) => c.status !== "ACTIVE" && c.status !== "PROSPECT");

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="No clients yet"
        description="Add your first client to get started."
        action={
          <Button asChild>
            <Link href="/clients/new">Add Client</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name or industry…"
            aria-label="Search clients"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="sm:w-48"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          compact
          icon={<Search />}
          title="No matching clients"
          description="Try a different name, industry, or status filter."
        />
      ) : (
        <div className="space-y-8">
          <ClientGroup title="Active" clients={active} />
          <ClientGroup title="Prospects" clients={prospects} />
          <ClientGroup title="Inactive" clients={inactive} />
        </div>
      )}
    </div>
  );
}

function ClientGroup({ title, clients }: { title: string; clients: ClientCardData[] }) {
  if (clients.length === 0) return null;
  return (
    <section>
      <SectionHeader title={`${title} (${clients.length})`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </section>
  );
}
