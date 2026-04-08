import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint — DELETE AFTER USE
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Must be SUPER_ADMIN" }, { status: 403 });
  }

  const existing = await db.user.findUnique({ where: { email: "carolina@ebmanagement.io" } });
  if (existing) {
    return NextResponse.json({ message: "Carolina already exists", user: existing });
  }

  const carolina = await db.user.create({
    data: {
      clerkId: "pending_carolina",
      email: "carolina@ebmanagement.io",
      name: "Carolina",
      role: "ASSISTANT",
    },
  });

  return NextResponse.json({ message: "Carolina added as Assistant", user: carolina });
}
