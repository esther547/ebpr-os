import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { formatDate, cn } from "@/lib/utils";

export const metadata = { title: "Settings" };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  STRATEGIST: "Strategist",
  RUNNER: "Runner",
  LEGAL: "Legal",
  FINANCE: "Finance",
  CLIENT_ADMIN: "Client Admin",
  CLIENT_VIEWER: "Client Viewer",
};

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-ink-primary text-ink-inverted",
  STRATEGIST: "bg-blue-50 text-blue-700",
  RUNNER: "bg-purple-50 text-purple-700",
  LEGAL: "bg-amber-50 text-amber-700",
  FINANCE: "bg-green-50 text-green-700",
  CLIENT_ADMIN: "bg-surface-2 text-ink-secondary",
  CLIENT_VIEWER: "bg-surface-2 text-ink-muted",
};

export default async function SettingsPage() {
  await requireRole("SUPER_ADMIN");

  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Team members & system configuration"
        actions={
          <button className="inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors">
            + Invite Team Member
          </button>
        }
      />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Team Members
        </h2>
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Joined</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center text-sm font-semibold text-ink-secondary flex-shrink-0">
                        {user.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-ink-primary">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{user.email}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        ROLE_STYLES[user.role] ?? "bg-surface-2 text-ink-secondary"
                      )}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        user.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-surface-2 text-ink-muted"
                      )}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
