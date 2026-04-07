import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["SUPER_ADMIN", "STRATEGIST", "RUNNER", "LEGAL", "FINANCE"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id },
    data: parsed.data,
  });

  await db.activityLog.create({
    data: {
      userId: user.id,
      action: "user_updated",
      description: `Updated team member ${updated.name}`,
    },
  });

  return NextResponse.json({ data: updated });
}
