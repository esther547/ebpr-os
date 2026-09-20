"use client";

import { useState } from "react";
import { Button } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { Check } from "lucide-react";

export function SignContractClient({
  token,
  alreadySigned,
  signedAt,
}: {
  token: string;
  alreadySigned: boolean;
  signedAt: string | null;
}) {
  const { toast } = useToast();
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(alreadySigned);

  async function handleSign() {
    setSigning(true);

    const res = await fetch(`/api/sign/${token}`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json();
      toast({ title: data.error || "Failed to sign", variant: "error" });
      setSigning(false);
      return;
    }

    setSigned(true);
    setSigning(false);
    toast({ title: "Contract signed", variant: "success" });
  }

  if (signed) {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-600/15">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-base font-semibold text-ink-primary">Contract signed</p>
        {signedAt && <p className="mt-1 text-sm text-ink-muted">Signed on {formatDate(signedAt)}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-secondary">
        By clicking &quot;Sign Contract&quot; below, you agree to the terms of this contract.
        Your signature will be recorded electronically with a timestamp and IP address.
      </p>
      <Button onClick={handleSign} loading={signing} size="lg" className="w-full">
        Sign Contract
      </Button>
    </div>
  );
}
