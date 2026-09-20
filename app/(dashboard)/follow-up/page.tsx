import { requireUser } from "@/lib/auth";
import { canViewFollowUp } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowUpClient } from "@/components/follow-up/follow-up-client";
import { Lock } from "lucide-react";

export const metadata = { title: "Follow-Up Contracts" };
export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const user = await requireUser();

  if (!canViewFollowUp(user)) {
    return <EmptyState icon={<Lock />} title="Access restricted" description="This page is limited to the follow-up team." />;
  }

  const unsignedContracts = await db.contract.findMany({
    where: { status: { in: ["DRAFT", "SENT"] } },
    select: {
      id: true,
      status: true,
      sentAt: true,
      createdAt: true,
      notes: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Contracts"
        title="Follow-Up"
        subtitle={`${unsignedContracts.length} contract${unsignedContracts.length !== 1 ? "s" : ""} awaiting signature`}
      />
      <FollowUpClient
        unsignedContracts={JSON.parse(JSON.stringify(unsignedContracts))}
        canEdit={true}
      />
    </>
  );
}
