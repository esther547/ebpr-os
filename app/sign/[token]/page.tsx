import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { SignContractClient } from "@/components/legal/sign-contract-client";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Sign Contract — EBPR" };
export const dynamic = "force-dynamic";

export default async function SignContractPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const signature = await db.contractSignature.findUnique({
    where: { token },
    include: {
      contract: {
        select: { id: true, title: true, startDate: true, endDate: true, client: { select: { name: true } } },
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

  const rows = [
    { label: "Signer", value: signature.signerName },
    { label: "Contract", value: signature.contract.title },
    { label: "Client", value: signature.contract.client.name },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface-1 px-4 py-10 sm:justify-center sm:py-14">
      <div className="page-enter mx-auto w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <EBPRLogoHorizontal size="md" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="border-b border-border px-6 py-6 sm:px-8">
            <p className="eyebrow mb-1.5">Electronic signature</p>
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">
              Contract Signature
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {signature.contract.client.name} — {signature.contract.title}
            </p>
          </div>

          <dl className="divide-y divide-border px-6 sm:px-8">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="text-xs uppercase tracking-wider text-ink-muted">{row.label}</dt>
                <dd className="break-words text-sm font-medium text-ink-primary sm:text-right">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-border px-6 py-6 sm:px-8">
            <SignContractClient
              token={token}
              alreadySigned={signature.status === "SIGNED"}
              signedAt={signature.signedAt ? signature.signedAt.toISOString() : null}
            />
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          EB Public Relations · Secure electronic signature
        </p>
      </div>
    </div>
  );
}
