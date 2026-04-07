"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Input, Select, FormGroup } from "@/components/ui/form-field";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string | Date;
};

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

export function SettingsPageClient({ users }: { users: UserRow[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const router = useRouter();

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowAdd(true)}>+ Add Team Member</Button>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Team Members ({users.length})
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
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center text-sm font-semibold text-ink-secondary flex-shrink-0">
                        {u.name[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="font-medium text-ink-primary">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_STYLES[u.role] ?? "bg-surface-2 text-ink-secondary")}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{formatDate(u.createdAt)}</td>
                  <td className="px-5 py-4">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", u.isActive ? "bg-green-50 text-green-700" : "bg-surface-2 text-ink-muted")}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setEditUser(u)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AddUserModal open={showAdd} onOpenChange={setShowAdd} />
      {editUser && (
        <EditUserModal
          open={!!editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null); }}
          user={editUser}
        />
      )}
    </>
  );
}

function AddUserModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      role: form.get("role") as string,
    };

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to add user");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Team Member" description="Add a new team member to EBPR OS">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Full Name" htmlFor="user-name" required>
          <Input id="user-name" name="name" placeholder="e.g., Carolina Rodriguez" required autoFocus />
        </FormGroup>

        <FormGroup label="Email" htmlFor="user-email" required>
          <Input id="user-email" name="email" type="email" placeholder="e.g., caro@ebpr.com" required />
        </FormGroup>

        <FormGroup label="Role" htmlFor="user-role" required>
          <Select id="user-role" name="role" required>
            <option value="">Select role...</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="STRATEGIST">Strategist</option>
            <option value="RUNNER">Runner</option>
            <option value="LEGAL">Legal</option>
            <option value="FINANCE">Finance</option>
          </Select>
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Team Member"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: UserRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      role: form.get("role") as string,
      isActive: form.get("isActive") === "true",
    };

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to update user");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit Team Member" description={`Editing ${user.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Full Name" htmlFor="edit-name" required>
          <Input id="edit-name" name="name" defaultValue={user.name} required />
        </FormGroup>

        <FormGroup label="Role" htmlFor="edit-role" required>
          <Select id="edit-role" name="role" defaultValue={user.role} required>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="STRATEGIST">Strategist</option>
            <option value="RUNNER">Runner</option>
            <option value="LEGAL">Legal</option>
            <option value="FINANCE">Finance</option>
          </Select>
        </FormGroup>

        <FormGroup label="Status" htmlFor="edit-active" required>
          <Select id="edit-active" name="isActive" defaultValue={user.isActive ? "true" : "false"} required>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
