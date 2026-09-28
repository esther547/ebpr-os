import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { canManagePressReleases, canOpenPressPage, canRequestPressRelease, canSendPressReleases, canWorkPressReleaseRequests, isWriter } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { PressReleasesClient } from "@/components/press-releases/press-releases-client";
import { RequestBoard } from "@/components/press-releases/request-board";
import { requestSelect, type PressReleaseRequestItem } from "@/lib/press-release-requests";

export const metadata = { title: "Press Releases" };
export const dynamic = "force-dynamic";

export default async function PressReleasesPage({ searchParams }: { searchParams?: { request?: string } }) {
  const user = await requireUser();
  if (!canOpenPressPage(user)) redirect(ROLE_HOME[user.role]);
  const fullAccess = canManagePressReleases(user);

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

  const [requestRows, writer] = await Promise.all([
    db.pressReleaseRequest.findMany({ select: requestSelect, orderBy: [{ dueDate: "asc" }] }),
    db.user.findFirst({ where: { role: "WRITER", isActive: true }, select: { name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const requests: PressReleaseRequestItem[] = requestRows.map((r) => ({
    ...r,
    dueDate: r.dueDate.toISOString(),
    doneAt: r.doneAt ? r.doneAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
  const writerName = writer?.name?.split(" ")[0] || "el redactor";

  return (
    <>
      <PageHeader
        title="Press Releases"
        subtitle={isWriter(user) ? `Hola ${user.name.split(" ")[0]}: aquí están los comunicados que el equipo necesita.` : "Solicitudes al redactor, borradores, aprobación y distribución"}
      />
      <RequestBoard
        initialRequests={requests}
        clients={clients}
        canWork={canWorkPressReleaseRequests(user)}
        canRequest={canRequestPressRelease(user)}
        writerName={writerName}
        highlightId={searchParams?.request ?? null}
      />
      {fullAccess && (
        <PressReleasesClient
          releases={JSON.parse(JSON.stringify(releases))}
          clients={clients}
          canSend={canSendPressReleases(user)}
        />
      )}
    </>
  );
}
