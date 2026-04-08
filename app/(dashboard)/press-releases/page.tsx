import { requireUser } from "@/lib/auth";
import { canManagePressReleases } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { PressReleasesClient } from "@/components/press-releases/press-releases-client";

export const metadata = { title: "Press Releases" };
export const dynamic = "force-dynamic";

export default async function PressReleasesPage() {
  const user = await requireUser();
  if (!canManagePressReleases(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const releases = await db.pressRelease.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Press Releases" subtitle="Draft, approve & distribute" />
      <PressReleasesClient
        releases={JSON.parse(JSON.stringify(releases))}
        clients={clients}
      />
    </>
  );
}
