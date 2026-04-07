"use client";

import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { CreateContractModal } from "@/components/contracts/create-contract-modal";

type ContractRow = {
  id: string;
  title: string;
  status: string;
  client: { id: string; name: string };
  value: unknown;
  startDate: string | Date | null;
  endDate: string | Date | null;
  signedAt: string | Date | null;
  billingReady: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-2 text-ink-secondary",
  SENT: "bg-amber-50 text-amber-700",
  SIGNED: "bg-green-50 text-green-700",
  EXPIRED: "bg-red-50 text-red-600",
  TERMINATED: "bg-red-50 text-red-600",
};

interface Props {
  contracts: ContractRow[];
  clients: { id: string; name: string }[];
}

export function LegalPageClient({ contracts, clients }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  const needsAction = contracts.filter(
    (c) => c.status === "DRAFT" || c.status === "SENT"
  );
  const signed = contracts.filter((c) => c.status === "SIGNED");

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowCreate(true)}>+ New Contract</Button>
      </div>

      {needsAction.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Needs Action ({needsAction.length})
          </h2>
          <ContractTable contracts={needsAction} />
        </section>
      )}

      {signed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Signed
          </h2>
          <ContractTable contracts={signed} />
        </section>
      )}

      {contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-ink-primary">No contracts yet</p>
          <p className="mt-1 text-sm text-ink-muted">Create the first contract.</p>
        </div>
      )}

      <CreateContractModal
        open={showCreate}
        onOpenChange={setShowCreate}
        clients={clients}
      />
    </>
  );
}

function ContractTable({ contracts }: { contracts: ContractRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-1">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Contract</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Signed</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Billing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contracts.map((contract) => (
            <tr key={contract.id} className="hover:bg-surface-1 transition-colors">
              <td className="px-5 py-4 font-medium text-ink-primary">{contract.title}</td>
              <td className="px-5 py-4 text-ink-secondary">{contract.client.name}</td>
              <td className="px-5 py-4">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[contract.status] || "bg-surface-2 text-ink-secondary")}>
                  {contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="px-5 py-4 text-ink-secondary">{formatDate(contract.signedAt)}</td>
              <td className="px-5 py-4">
                {contract.billingReady ? (
                  <span className="text-green-700 font-medium">Ready</span>
                ) : (
                  <span className="text-ink-muted">Pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
