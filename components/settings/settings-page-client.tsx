"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { Input, Select, FormGroup, FormActions } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuDots,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Pencil, UserMinus, UserPlus, Users, Plus } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  hasSignedIn: boolean;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  STRATEGIST: "Strategist",
  RUNNER: "Runner",
  LEGAL: "Legal",
  FINANCE: "Follow-up (Laurie)",
  ASSISTANT: "Assistant",
  CLIENT_ADMIN: "Client Admin",
  CLIENT_VIEWER: "Client Viewer",
};

const ROLE_TONES: Record<string, BadgeTone> = {
  SUPER_ADMIN: "dark",
  STRATEGIST: "info",
  RUNNER: "purple",
  LEGAL: "warning",
  FINANCE: "success",
  ASSISTANT: "outline",
  CLIENT_ADMIN: "neutral",
  CLIENT_VIEWER: "neutral",
};

const ROLE_OPTIONS = [
  ["SUPER_ADMIN", "Super Admin"],
  ["STRATEGIST", "Strategist"],
  ["LEGAL", "Legal"],
  ["FINANCE", "Follow-up (Laurie)"],
  ["ASSISTANT", "Assistant"],
  ["RUNNER", "Runner"],
] as const;

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function SettingsPageClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deactivating, setDeactivating] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const activeAdmins = users.filter((u) => u.role === "SUPER_ADMIN" && u.isActive).length;
  const active = users.filter((u) => u.isActive);
  const inactive = users.filter((u) => !u.isActive);
  const ordered = [...active, ...inactive];

  async function setActive(u: UserRow, next: boolean) {
    setBusyId(u.id);
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    }).catch(() => null);
    if (!res || !res.ok) {
      toast({
        title: "Could not update team member",
        description: res ? await readError(res, "Failed to update team member") : "Network error",
        variant: "error",
      });
      setBusyId(null);
      return false;
    }
    setBusyId(null);
    toast({
      title: next ? `${u.name} reactivated` : `${u.name} deactivated`,
      description: next ? "They can sign in again." : "They no longer have access.",
      variant: "success",
    });
    router.refresh();
    return true;
  }

  function toggleActive(u: UserRow) {
    const next = !u.isActive;
    if (!next) {
      setDeactivating(u);
      return;
    }
    void setActive(u, true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-xs text-ink-muted">
          Only people listed here can sign in. Access is linked to the email on first sign-in.
        </p>
        <Button onClick={() => setShowAdd(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Add Team Member
        </Button>
      </div>

      <section>
        <SectionHeader
          title="Team Members"
          description={`${active.length} active${inactive.length ? ` · ${inactive.length} inactive` : ""}`}
        />
        {ordered.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No team members yet"
            description="Add the people who should be able to sign in to EBPR OS."
            action={
              <Button onClick={() => setShowAdd(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Add Team Member
              </Button>
            }
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <TableWrap className="rounded-none border-0 shadow-none">
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Added</Th>
                    <Th>Status</Th>
                    <Th align="right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((u) => {
                    const isLastAdmin = u.role === "SUPER_ADMIN" && u.isActive && activeAdmins <= 1;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} className={cn(!u.isActive && "opacity-60")}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold text-ink-secondary">
                              {u.name[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="whitespace-nowrap font-medium text-ink-primary">
                              {u.name}
                              {u.id === currentUserId && (
                                <span className="ml-2 text-xs font-normal text-ink-muted">(you)</span>
                              )}
                            </span>
                          </div>
                        </Td>
                        <Td className="text-ink-secondary">{u.email}</Td>
                        <Td>
                          <Badge tone={ROLE_TONES[u.role] ?? "neutral"}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-ink-secondary tabular">{formatDate(u.createdAt)}</Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={u.isActive ? "success" : "neutral"} dot>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <span title={u.hasSignedIn ? "Account linked to their sign-in" : "Added, but has not signed in yet"}>
                              <Badge tone={u.hasSignedIn ? "outline" : "warning"}>
                                {u.hasSignedIn ? "Signed in" : "Not signed in yet"}
                              </Badge>
                            </span>
                          </div>
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuDots label={`Actions for ${u.name}`} className={cn(busy && "pointer-events-none opacity-50")} />
                              <DropdownMenuContent>
                                <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditUser(u)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  icon={u.isActive ? <UserMinus /> : <UserPlus />}
                                  destructive={u.isActive}
                                  disabled={busy || isLastAdmin}
                                  title={isLastAdmin ? "The last Super Admin can't be deactivated" : undefined}
                                  onSelect={() => toggleActive(u)}
                                >
                                  {busy ? "Saving..." : u.isActive ? "Deactivate" : "Reactivate"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </section>

      <AddUserModal open={showAdd} onOpenChange={setShowAdd} />
      {editUser && (
        <EditUserModal
          open={!!editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null); }}
          user={editUser}
          isLastAdmin={editUser.role === "SUPER_ADMIN" && editUser.isActive && activeAdmins <= 1}
        />
      )}
      <ConfirmModal
        open={!!deactivating}
        onOpenChange={(open) => { if (!open) setDeactivating(null); }}
        title={deactivating ? `Deactivate ${deactivating.name}?` : "Deactivate team member?"}
        description="They will lose access immediately. You can reactivate them later."
        confirmLabel="Deactivate"
        destructive
        loading={!!deactivating && busyId === deactivating.id}
        onConfirm={async () => {
          if (!deactivating) return;
          const ok = await setActive(deactivating, false);
          if (ok) setDeactivating(null);
        }}
      />
    </div>
  );
}

function AddUserModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      role: form.get("role") as string,
    };

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res || !res.ok) {
      toast({
        title: "Could not add team member",
        description: res ? await readError(res, "Failed to add team member") : "Network error",
        variant: "error",
      });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({
      title: "Team member added",
      description: `${body.name} gets access the first time they sign in with ${body.email}.`,
      variant: "success",
    });
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Team Member"
      description="They get access the first time they sign in with this email"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Full Name" htmlFor="user-name" required>
          <Input id="user-name" name="name" placeholder="e.g., Carolina Rodriguez" required autoFocus />
        </FormGroup>

        <FormGroup label="Email" htmlFor="user-email" required>
          <Input id="user-email" name="email" type="email" placeholder="e.g., caro@ebmanagement.io" required />
        </FormGroup>

        <FormGroup label="Role" htmlFor="user-role" required>
          <Select id="user-role" name="role" required defaultValue="">
            <option value="" disabled>Select role...</option>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add Team Member
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

function EditUserModal({
  open,
  onOpenChange,
  user,
  isLastAdmin,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: UserRow;
  isLastAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: String(form.get("name") ?? "").trim(),
    };
    // Disabled selects are not part of FormData; the last Super Admin's role/status are locked.
    if (!isLastAdmin) {
      body.role = form.get("role") as string;
      body.isActive = form.get("isActive") === "true";
    }
    if (!user.hasSignedIn) {
      body.email = String(form.get("email") ?? "").trim().toLowerCase();
    }

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res || !res.ok) {
      toast({
        title: "Could not save changes",
        description: res ? await readError(res, "Failed to update team member") : "Network error",
        variant: "error",
      });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({ title: "Team member updated", variant: "success" });
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit Team Member" description={`Editing ${user.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Full Name" htmlFor="edit-name" required>
          <Input id="edit-name" name="name" defaultValue={user.name} required />
        </FormGroup>

        <FormGroup
          label="Email"
          htmlFor="edit-email"
          required
          description={
            user.hasSignedIn
              ? "Locked — this account has already signed in."
              : "Can still be corrected until they sign in for the first time."
          }
        >
          <Input
            id="edit-email"
            name="email"
            type="email"
            defaultValue={user.email}
            disabled={user.hasSignedIn}
            required
          />
        </FormGroup>

        <FormGroup
          label="Role"
          htmlFor="edit-role"
          required
          description={isLastAdmin ? "This is the only active Super Admin, so the role is locked." : undefined}
        >
          <Select id="edit-role" name="role" defaultValue={user.role} required disabled={isLastAdmin}>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Status" htmlFor="edit-active" required>
          <Select id="edit-active" name="isActive" defaultValue={user.isActive ? "true" : "false"} required disabled={isLastAdmin}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
