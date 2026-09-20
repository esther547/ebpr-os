"use client";

import { useState } from "react";
import { Share2, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

export function ShareMonitorButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const { toast } = useToast();

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
      toast({ title: "Link copied", variant: "success" });
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={generateLink}
        loading={loading}
        leftIcon={<Share2 className="h-3.5 w-3.5" />}
      >
        Share Monitor
      </Button>

      {url && (
        <Modal
          open={!!url}
          onOpenChange={() => setUrl(null)}
          title="Campaign Monitor Link"
          description="Share this link with your client"
        >
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              This link gives the client a read-only view of their deliverables, agenda, and PR
              insights. No login required.
            </p>
            <div className="break-all rounded-lg border border-border bg-surface-1 p-3 font-mono text-sm text-ink-primary">
              {url}
            </div>
            <Button onClick={copyLink} className="w-full" leftIcon={<Copy className="h-3.5 w-3.5" />}>
              Copy Link
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
