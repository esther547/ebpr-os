"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ExternalLink, FileText, Pencil, Download } from "lucide-react";

interface Props {
  clientId: string;
  strategyDocUrl: string | null;
}

export function StrategyDocLink({ clientId, strategyDocUrl }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function importStrategy() {
    setImporting(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/import-strategy`, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast({ title: data.message ?? "Import complete", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Import failed",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
    }
    setImporting(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const url = ((form.get("url") as string) || "").trim() || null;

    if (url && !/^https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_-]+/.test(url)) {
      toast({
        title: "That doesn't look like a Google Doc link",
        description: "Expected https://docs.google.com/document/d/…",
        variant: "error",
      });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyDocUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not save link",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setSaving(false);
        return;
      }
      setSaving(false);
      setShowEdit(false);
      toast({ title: "Strategy document link saved", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-secondary">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink-primary">Strategy Document</h3>
              <p className="text-xs text-ink-muted">
                {strategyDocUrl ? "Google Doc with full strategy details" : "No document linked"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {strategyDocUrl && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={importStrategy}
                  loading={importing}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  Import as Tasks
                </Button>
                <Button asChild size="sm">
                  <a href={strategyDocUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Document
                  </a>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEdit(true)}
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
            >
              {strategyDocUrl ? "Edit" : "Add Link"}
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={showEdit}
        onOpenChange={setShowEdit}
        title="Strategy Document Link"
        description="Paste a Google Doc link for this client's strategy"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FormGroup
            label="Google Doc URL"
            htmlFor="sd-url"
            description="Make sure the document is shared with your team."
          >
            <Input
              id="sd-url"
              name="url"
              type="url"
              defaultValue={strategyDocUrl || ""}
              placeholder="https://docs.google.com/document/d/..."
              autoFocus
            />
          </FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Link
            </Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}
