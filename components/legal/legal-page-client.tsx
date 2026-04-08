"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { CreateContractModal } from "@/components/contracts/create-contract-modal";
import { Modal } from "@/components/ui/modal";
import { Input, FormGroup } from "@/components/ui/form-field";
import { Send, Upload, FileText, Check, X } from "lucide-react";

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
  fileUrl: string | null;
  fileName: string | null;
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
  const [uploadContract, setUploadContract] = useState<ContractRow | null>(null);
  const router = useRouter();

  const notSigned = contracts.filter(
    (c) => c.status !== "SIGNED" && c.status !== "EXPIRED" && c.status !== "TERMINATED"
  );
  const signed = contracts.filter((c) => c.status === "SIGNED");

  async function toggleStatus(contractId: string, currentStatus: string) {
    const newStatus = currentStatus === "SIGNED" ? "SENT" : "SIGNED";
    await fetch(`/api/contracts/${contractId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowCreate(true)}>+ New Contract</Button>
      </div>

      {/* Not Signed */}
      {notSigned.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Not Signed ({notSigned.length})
          </h2>
          <ContractTable
            contracts={notSigned}
            onSend={setSendContract}
            onUpload={setUploadContract}
            onToggleStatus={toggleStatus}
          />
        </section>
      )}

      {/* Signed */}
      {signed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Signed ({signed.length})
          </h2>
          <ContractTable
            contracts={signed}
            onToggleStatus={toggleStatus}
          />
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

      {uploadContract && (
        <UploadContractModal
          open={!!uploadContract}
          onOpenChange={(o) => { if (!o) setUploadContract(null); }}
          contract={uploadContract}
        />
      )}
    </>
  );
}

function ContractTable({
  contracts,
  onSend,
  onUpload,
  onToggleStatus,
}: {
  contracts: ContractRow[];
  onSend?: (c: ContractRow) => void;
  onUpload?: (c: ContractRow) => void;
  onToggleStatus: (id: string, status: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-1">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Contract</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">File</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Signed</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contracts.map((contract) => (
            <tr key={contract.id} className="hover:bg-surface-1 transition-colors">
              <td className="px-5 py-4 font-medium text-ink-primary">{contract.title}</td>
              <td className="px-5 py-4 text-ink-secondary">{contract.client.name}</td>
              <td className="px-5 py-4">
                <button
                  onClick={() => onToggleStatus(contract.id, contract.status)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                    contract.status === "SIGNED"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  )}
                  title={contract.status === "SIGNED" ? "Click to mark as Not Signed" : "Click to mark as Signed"}
                >
                  {contract.status === "SIGNED" ? (
                    <><Check className="h-3 w-3" /> Signed</>
                  ) : (
                    <><X className="h-3 w-3" /> Not Signed</>
                  )}
                </button>
              </td>
              <td className="px-5 py-4">
                {contract.fileUrl ? (
                  <a
                    href={contract.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    {contract.fileName || "View PDF"}
                  </a>
                ) : (
                  <span className="text-xs text-ink-muted">No file</span>
                )}
              </td>
              <td className="px-5 py-4 text-ink-secondary">{formatDate(contract.signedAt)}</td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  {onUpload && (
                    <button
                      onClick={() => onUpload(contract)}
                      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
                    >
                      <Upload className="h-3 w-3" />
                      Upload PDF
                    </button>
                  )}
                  {onSend && (contract.status === "DRAFT" || contract.status === "SENT") && (
                    <button
                      onClick={() => onSend(contract)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Send className="h-3 w-3" />
                      Send for Signature
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadContractModal({ open, onOpenChange, contract }: { open: boolean; onOpenChange: (o: boolean) => void; contract: ContractRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const fileUrl = form.get("fileUrl") as string;
    const fileName = form.get("fileName") as string;

    if (!fileUrl) {
      setError("Please enter a file URL");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, fileName: fileName || "Contract.pdf" }),
    });

    if (!res.ok) {
      setError("Failed to update contract");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Upload Contract PDF" description={`${contract.title} — ${contract.client.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <p className="text-sm text-ink-secondary">
          Upload your contract PDF to Google Drive or Dropbox, then paste the link here.
        </p>

        <FormGroup label="PDF Link" htmlFor="up-url" required>
          <Input id="up-url" name="fileUrl" type="url" placeholder="https://drive.google.com/..." required autoFocus defaultValue={contract.fileUrl || ""} />
        </FormGroup>

        <FormGroup label="File Name" htmlFor="up-name">
          <Input id="up-name" name="fileName" placeholder="e.g., Reykon_Contract_2026.pdf" defaultValue={contract.fileName || ""} />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save PDF Link"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
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
          <p className="text-sm text-ink-secondary">Share this link with the signer:</p>
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
    <Modal open={open} onOpenChange={onOpenChange} title="Send for Signature" description={`${contract.title} — ${contract.client.name}`}>
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
