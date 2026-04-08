"use client";

import { useState } from "react";
import { Button } from "@/components/ui/form-field";
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
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(alreadySigned);
  const [error, setError] = useState<string | null>(null);

  async function handleSign() {
    setSigning(true);
    setError(null);

    const res = await fetch(`/api/sign/${token}`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to sign");
      setSigning(false);
      return;
    }

    setSigned(true);
    setSigning(false);
  }

  if (signed) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-50 mb-3">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-lg font-semibold text-green-700">Contract Signed</p>
        {signedAt && (
          <p className="text-sm text-ink-muted mt-1">Signed on {formatDate(signedAt)}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}
      <p className="text-sm text-ink-secondary mb-4">
        By clicking &quot;Sign Contract&quot; below, you agree to the terms of this contract.
        Your signature will be recorded electronically with a timestamp and IP address.
      </p>
      <Button onClick={handleSign} disabled={signing} className="w-full">
        {signing ? "Signing..." : "Sign Contract"}
      </Button>
    </div>
  );
}
