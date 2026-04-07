import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "STRATEGIST", "RUNNER", "LEGAL", "FINANCE"]),
});

export async function GET() {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, name, role } = parsed.data;

  // Check if email already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Create user with a placeholder clerkId (will be linked on first sign-in)
  const newUser = await db.user.create({
    data: {
      clerkId: `pending_${Date.now()}`,
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
