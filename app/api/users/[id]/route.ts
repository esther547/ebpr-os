import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
  role: z.enum(["SUPER_ADMIN", "STRATEGIST", "RUNNER", "LEGAL", "FINANCE", "ASSISTANT"]).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: first, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  const data: { name?: string; email?: string; role?: (typeof parsed.data)["role"]; isActive?: boolean } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  // Email can only be corrected while the account is still pending (not yet linked to Clerk).
  if (parsed.data.email !== undefined && parsed.data.email !== target.email) {
    if (!target.clerkId.startsWith("pending_")) {
      return NextResponse.json(
        { error: "This person has already signed in; their email can no longer be changed here" },
        { status: 400 }
      );
    }
    const clash = await db.user.findFirst({
      where: { id: { not: id }, email: { equals: parsed.data.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Another team member already uses this email" }, { status: 409 });
    }
    data.email = parsed.data.email;
  }

  // Lock-out guard: never demote or deactivate the last active SUPER_ADMIN.
  const wasActiveAdmin = target.role === "SUPER_ADMIN" && target.isActive;
  const willRemainActiveAdmin =
    (data.role ?? target.role) === "SUPER_ADMIN" && (data.isActive ?? target.isActive);
  if (wasActiveAdmin && !willRemainActiveAdmin) {
    const otherAdmins = await db.user.count({
      where: { id: { not: id }, role: "SUPER_ADMIN", isActive: true },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "You can't remove the last Super Admin — promote someone else first" },
        { status: 400 }
      );
    }
  }

  const updated = await db.user.update({ where: { id }, data });

  const changes: string[] = [];
  if (data.role && data.role !== target.role) changes.push(`role → ${data.role}`);
  if (data.isActive !== undefined && data.isActive !== target.isActive) {
    changes.push(data.isActive ? "reactivated" : "deactivated");
  }
  if (data.email) changes.push(`email → ${data.email}`);

  await db.activityLog.create({
    data: {
      userId: user.id,
      action: "user_updated",
      description: `Updated team member ${updated.name}${changes.length ? ` (${changes.join(", ")})` : ""}`,
    },
  });

  return NextResponse.json({ data: updated });
}
