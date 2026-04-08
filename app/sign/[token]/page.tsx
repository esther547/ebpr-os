import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { SignContractClient } from "@/components/legal/sign-contract-client";

export const metadata = { title: "Sign Contract — EBPR" };
export const dynamic = "force-dynamic";

export default async function SignContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const signature = await db.contractSignature.findUnique({
    where: { token },
    include: {
      contract: {
        select: { id: true, title: true, value: true, startDate: true, endDate: true, client: { select: { name: true } } },
      },
    },
  });

  if (!signature) return notFound();

  // Mark as viewed
  if (!signature.viewedAt) {
    await db.contractSignature.update({
      where: { token },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  return (
    <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <EBPRLogoHorizontal size="md" />
        </div>

        <div className="rounded-lg border border-border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-ink-primary mb-1">Contract Signature</h1>
          <p className="text-sm text-ink-muted mb-6">
            {signature.contract.client.name} — {signature.contract.title}
          </p>

          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-ink-muted">Signer</span>
              <span className="font-medium text-ink-primary">{signature.signerName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-ink-muted">Contract</span>
              <span className="font-medium text-ink-primary">{signature.contract.title}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-ink-muted">Client</span>
              <span className="font-medium text-ink-primary">{signature.contract.client.name}</span>
            </div>
          </div>

          <SignContractClient
            token={token}
            alreadySigned={signature.status === "SIGNED"}
            signedAt={signature.signedAt ? signature.signedAt.toISOString() : null}
          />
        </div>

        <p className="text-center text-xs text-ink-muted mt-6">
          EB Public Relations · Secure Electronic Signature
        </p>
      </div>
    </div>
  );
}
