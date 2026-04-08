"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/form-field";

export function ShareMonitorButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generateLink() {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/share`, { method: "POST" });
    const data = await res.json();
    setUrl(data.url);
    setLoading(false);
  }

  function copyLink() {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={generateLink}
        disabled={loading}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-4 text-sm font-medium text-ink-primary hover:bg-surface-2 transition-colors"
      >
        <Share2 className="h-3.5 w-3.5" />
        {loading ? "Generating..." : "Share Monitor"}
      </button>

      {url && (
        <Modal open={!!url} onOpenChange={() => setUrl(null)} title="Campaign Monitor Link" description="Share this link with your client">
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              This link gives the client a read-only view of their deliverables, agenda, and PR insights. No login required.
            </p>
            <div className="rounded-md bg-surface-1 p-3 text-sm break-all font-mono text-ink-primary border border-border">
              {url}
            </div>
            <Button onClick={copyLink} className="w-full">
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
