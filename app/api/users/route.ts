import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  name: z.string().trim().min(1, "Name is required"),
  role: z.enum(["SUPER_ADMIN", "STRATEGIST", "RUNNER", "LEGAL", "FINANCE", "ASSISTANT"]),
});

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: first, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, name, role } = parsed.data;

  // Email is the access key: match case-insensitively so "Esther@..." and "esther@..." can't both exist.
  const existing = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, isActive: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: existing.isActive
          ? `${existing.name} already has access with this email`
          : `${existing.name} already exists with this email but is inactive — reactivate them from the team list instead`,
      },
      { status: 409 }
    );
  }

  // Placeholder clerkId; replaced with the real Clerk id on first sign-in (see lib/auth.ts)
  const newUser = await db.user.create({
    data: {
      clerkId: `pending_${randomUUID()}`,
      email,
      name,
      role,
    },
  });

  await db.activityLog.create({
    data: {
      userId: user.id,
      action: "user_created",
      description: `Added team member ${name} (${role})`,
    },
  });

  return NextResponse.json({ data: newUser }, { status: 201 });
}
