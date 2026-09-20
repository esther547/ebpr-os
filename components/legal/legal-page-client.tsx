"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button, Input, FormGroup, FormActions } from "@/components/ui/form-field";
import { CreateContractModal } from "@/components/contracts/create-contract-modal";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Send, Upload, FileText, Check, X, Plus, Copy, Scale } from "lucide-react";
import { apiErrorMessage } from "@/lib/form-helpers";

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

interface Props {
  contracts: ContractRow[];
  clients: { id: string; name: string }[];
}

export function LegalPageClient({ contracts, clients }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [sendContract, setSendContract] = useState<ContractRow | null>(null);
  const [uploadContract, setUploadContract] = useState<ContractRow | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const notSigned = contracts.filter(
    (c) => c.status !== "SIGNED" && c.status !== "EXPIRED" && c.status !== "TERMINATED"
  );
  const signed = contracts.filter((c) => c.status === "SIGNED");
  const ended = contracts.filter((c) => c.status === "EXPIRED" || c.status === "TERMINATED");
  const needsAction = contracts.filter((c) => c.status === "DRAFT" || c.status === "SENT").length;

  async function toggleStatus(contractId: string, currentStatus: string) {
    const newStatus = currentStatus === "SIGNED" ? "SENT" : "SIGNED";
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ title: apiErrorMessage(data, "Failed to update contract status"), variant: "error" });
        return;
      }
      toast({ title: newStatus === "SIGNED" ? "Marked as signed" : "Marked as not signed", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error — status not updated", variant: "error" });
    }
  }

  return (
    <>
      <PageHeader
        title="Legal & Contracts"
        subtitle={`${contracts.length} contract${contracts.length !== 1 ? "s" : ""} · ${needsAction} need action`}
        actions={
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Contract
          </Button>
        }
      />

      <div className="space-y-6 pb-10">
        {contracts.length === 0 ? (
          <EmptyState
            icon={<Scale />}
            title="No contracts yet"
            description="Create the first contract to start tracking signatures and files."
            action={
              <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
                New Contract
              </Button>
            }
          />
        ) : (
          <>
            {notSigned.length > 0 && (
              <section>
                <SectionHeader
                  title={`Not signed (${notSigned.length})`}
                  description="Awaiting signature or still in draft"
                />
                <ContractTable
                  contracts={notSigned}
                  onSend={setSendContract}
                  onUpload={setUploadContract}
                  onToggleStatus={toggleStatus}
                />
              </section>
            )}

            {signed.length > 0 && (
              <section>
                <SectionHeader title={`Signed (${signed.length})`} description="Executed contracts" />
                <ContractTable contracts={signed} onToggleStatus={toggleStatus} />
              </section>
            )}

            {ended.length > 0 && (
              <section>
                <SectionHeader title={`Ended (${ended.length})`} description="Expired or terminated contracts" />
                <ContractTable contracts={ended} onToggleStatus={toggleStatus} />
              </section>
            )}
          </>
        )}
      </div>

      <CreateContractModal open={showCreate} onOpenChange={setShowCreate} clients={clients} />

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

// ─── Contract table ──────────────────────────────────────

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
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Contract</Th>
            <Th>Client</Th>
            <Th>Status</Th>
            <Th>File</Th>
            <Th>Signed</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => {
            const isSigned = contract.status === "SIGNED";
            return (
              <tr key={contract.id}>
                <Td className="font-medium text-ink-primary">{contract.title}</Td>
                <Td className="text-ink-secondary">{contract.client.name}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => onToggleStatus(contract.id, contract.status)}
                    className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25 focus-visible:ring-offset-2"
                    title={isSigned ? "Click to mark as not signed" : "Click to mark as signed"}
                  >
                    <Badge tone={isSigned ? "success" : "danger"}>
                      {isSigned ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {isSigned ? "Signed" : "Not signed"}
                    </Badge>
                  </button>
                </Td>
                <Td>
                  {contract.fileUrl ? (
                    <a
                      href={contract.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[200px] items-center gap-1.5 truncate text-xs text-ink-primary underline-offset-2 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                      <span className="truncate">{contract.fileName || "View PDF"}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-ink-muted">No file</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap tabular text-ink-secondary">
                  {formatDate(contract.signedAt) || "—"}
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    {onUpload && (
                      <Button
                        size="xs"
                        variant="secondary"
                        leftIcon={<Upload className="h-3 w-3" />}
                        onClick={() => onUpload(contract)}
                      >
                        Upload PDF
                      </Button>
                    )}
                    {onSend && (contract.status === "DRAFT" || contract.status === "SENT") && (
                      <Button
                        size="xs"
                        variant="secondary"
                        leftIcon={<Send className="h-3 w-3" />}
                        onClick={() => onSend(contract)}
                      >
                        Send for signature
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}

// ─── Upload PDF link ─────────────────────────────────────

function UploadContractModal({ open, onOpenChange, contract }: { open: boolean; onOpenChange: (o: boolean) => void; contract: ContractRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const fileUrl = form.get("fileUrl") as string;
    const fileName = form.get("fileName") as string;

    if (!fileUrl) {
      toast({ title: "Please enter a file URL", variant: "error" });
      setLoading(false);
      return;
    }

    let res: Response;
    try {
      res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, fileName: fileName || "Contract.pdf" }),
      });
    } catch {
      toast({ title: "Network error — link not saved", variant: "error" });
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ title: apiErrorMessage(data, "Failed to update contract"), variant: "error" });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({ title: "PDF link saved", variant: "success" });
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Upload Contract PDF" description={`${contract.title} — ${contract.client.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-secondary">
          Upload your contract PDF to Google Drive or Dropbox, then paste the link here.
        </p>

        <FormGroup label="PDF Link" htmlFor="up-url" required>
          <Input id="up-url" name="fileUrl" type="url" placeholder="https://drive.google.com/..." required autoFocus defaultValue={contract.fileUrl || ""} />
        </FormGroup>

        <FormGroup label="File Name" htmlFor="up-name">
          <Input id="up-name" name="fileName" placeholder="e.g., Reykon_Contract_2026.pdf" defaultValue={contract.fileName || ""} />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save PDF Link
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─── Send for signature ──────────────────────────────────

function SendForSignatureModal({ open, onOpenChange, contract }: { open: boolean; onOpenChange: (o: boolean) => void; contract: ContractRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      signerName: form.get("signerName") as string,
      signerEmail: form.get("signerEmail") as string,
    };

    let res: Response;
    try {
      res = await fetch(`/api/contracts/${contract.id}/send-for-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      toast({ title: "Network error — link not generated", variant: "error" });
      setLoading(false);
      return;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      toast({ title: apiErrorMessage(data, "Failed to send"), variant: "error" });
      setLoading(false);
      return;
    }

    setSigningUrl(data.signingUrl);
    setLoading(false);
    router.refresh();
  }

  if (signingUrl) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Signing Link Ready"
        description={`Contract: ${contract.title}`}
        footer={
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">Share this link with the signer:</p>
          <div className="break-all rounded-lg border border-border bg-surface-1 p-3 font-mono text-xs text-ink-primary">
            {signingUrl}
          </div>
          <Button
            className="w-full"
            leftIcon={<Copy className="h-4 w-4" />}
            onClick={() => {
              navigator.clipboard?.writeText(signingUrl).catch(() => {});
              toast({ title: "Signing link copied", variant: "success" });
            }}
          >
            Copy Link
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Send for Signature" description={`${contract.title} — ${contract.client.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Signer Name" htmlFor="sig-name" required>
          <Input id="sig-name" name="signerName" placeholder="e.g., John Smith" required autoFocus />
        </FormGroup>
        <FormGroup label="Signer Email" htmlFor="sig-email" required>
          <Input id="sig-email" name="signerEmail" type="email" placeholder="e.g., john@client.com" required />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Generate Signing Link
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
