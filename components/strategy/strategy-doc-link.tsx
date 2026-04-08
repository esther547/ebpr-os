"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, FormGroup } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { ExternalLink, FileText, Pencil } from "lucide-react";

interface Props {
  clientId: string;
  strategyDocUrl: string | null;
}

export function StrategyDocLink({ clientId, strategyDocUrl }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const router = useRouter();

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const url = (form.get("url") as string) || null;

    await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategyDocUrl: url }),
    });

    setShowEdit(false);
    router.refresh();
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-white p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">Strategy Document</h3>
              <p className="text-xs text-ink-muted">Google Doc with full strategy details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {strategyDocUrl ? (
              <a
                href={strategyDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Document
              </a>
            ) : (
              <span className="text-sm text-ink-muted">No document linked</span>
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-medium text-ink-secondary hover:bg-surface-2 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              {strategyDocUrl ? "Edit" : "Add Link"}
            </button>
          </div>
        </div>
      </div>

      <Modal open={showEdit} onOpenChange={setShowEdit} title="Strategy Document Link" description="Paste a Google Doc link for this client's strategy">
        <form onSubmit={handleSave} className="space-y-4">
          <FormGroup label="Google Doc URL" htmlFor="sd-url">
            <Input
              id="sd-url"
              name="url"
              type="url"
              defaultValue={strategyDocUrl || ""}
              placeholder="https://docs.google.com/document/d/..."
              autoFocus
            />
          </FormGroup>
          <p className="text-xs text-ink-muted">
            Paste the Google Doc link here. Make sure the document is shared with your team.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="submit">Save Link</Button>
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
