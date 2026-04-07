import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint to fix the SUPER_ADMIN role for the first user
// DELETE THIS FILE after use
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Find or create the user
  let user = await db.user.findUnique({ where: { clerkId: userId } });

  if (!user) {
    return NextResponse.json({ error: "User not found in DB" }, { status: 404 });
  }

  // Update to SUPER_ADMIN
  user = await db.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  });

  return NextResponse.json({
    message: `Updated ${user.name} (${user.email}) to SUPER_ADMIN`,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
