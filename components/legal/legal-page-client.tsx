"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { CreateContractModal } from "@/components/contracts/create-contract-modal";
import { Modal } from "@/components/ui/modal";
import { Input, FormGroup } from "@/components/ui/form-field";
import { Send } from "lucide-react";

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
  const [sendContract, setSendContract] = useState<ContractRow | null>(null);

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
          <ContractTable contracts={needsAction} onSend={setSendContract} />
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

      {sendContract && (
        <SendForSignatureModal
          open={!!sendContract}
          onOpenChange={(o) => { if (!o) setSendContract(null); }}
          contract={sendContract}
        />
      )}
    </>
  );
}

function ContractTable({ contracts, onSend }: { contracts: ContractRow[]; onSend?: (c: ContractRow) => void }) {
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
            {onSend && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>}
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
              {onSend && (
                <td className="px-5 py-4">
                  {(contract.status === "DRAFT" || contract.status === "SENT") && (
                    <button
                      onClick={() => onSend(contract)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Send className="h-3 w-3" />
                      Send for Signature
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SendForSignatureModal({ open, onOpenChange, contract }: { open: boolean; onOpenChange: (o: boolean) => void; contract: ContractRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      signerName: form.get("signerName") as string,
      signerEmail: form.get("signerEmail") as string,
    };

    const res = await fetch(`/api/contracts/${contract.id}/send-for-signature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to send");
      setLoading(false);
      return;
    }

    setSigningUrl(data.signingUrl);
    setLoading(false);
    router.refresh();
  }

  if (signingUrl) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Signing Link Ready" description={`Contract: ${contract.title}`}>
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">Share this link with the signer. They can sign directly from the link:</p>
          <div className="rounded-md bg-surface-1 p-3 text-sm break-all font-mono text-ink-primary border border-border">
            {signingUrl}
          </div>
          <Button onClick={() => { navigator.clipboard.writeText(signingUrl); }} className="w-full">
            Copy Link
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Send for Signature" description={`Contract: ${contract.title} — ${contract.client.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Signer Name" htmlFor="sig-name" required>
          <Input id="sig-name" name="signerName" placeholder="e.g., John Smith" required autoFocus />
        </FormGroup>

        <FormGroup label="Signer Email" htmlFor="sig-email" required>
          <Input id="sig-email" name="signerEmail" type="email" placeholder="e.g., john@client.com" required />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate Signing Link"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
