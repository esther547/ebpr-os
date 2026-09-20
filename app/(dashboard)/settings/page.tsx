import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      clerkId: true,
      createdAt: true,
    },
  });

  // A "pending_" clerkId means the person has been added but has not signed in yet.
  const rows = users.map(({ clerkId, createdAt, ...u }) => ({
    ...u,
    hasSignedIn: !clerkId.startsWith("pending_"),
    createdAt: createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Team members & system configuration"
      />
      <SettingsPageClient users={rows} currentUserId={user.id} />
    </>
  );
}
