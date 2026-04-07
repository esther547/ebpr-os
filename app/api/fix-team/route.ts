import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint to fix team emails — DELETE AFTER USE
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Must be SUPER_ADMIN" }, { status: 403 });
  }

  const changes: string[] = [];

  // Fix Ana's email
  const ana = await db.user.findUnique({ where: { email: "ana@ebpublicrelations.com" } });
  if (ana) {
    await db.user.update({ where: { id: ana.id }, data: { email: "aduran@ebmanagement.io" } });
    changes.push("Ana → aduran@ebmanagement.io");
  }

  // Fix Paola's email
  const paola = await db.user.findUnique({ where: { email: "paola@ebpublicrelations.com" } });
  if (paola) {
    await db.user.update({ where: { id: paola.id }, data: { email: "paolaprecilla@ebmanagement.io" } });
    changes.push("Paola → paolaprecilla@ebmanagement.io");
  }

  // Fix Verónica's email
  const vero = await db.user.findUnique({ where: { email: "vero@ebpublicrelations.com" } });
  if (vero) {
    await db.user.update({ where: { id: vero.id }, data: { email: "veronicaf@ebmanagement.io" } });
    changes.push("Verónica → veronicaf@ebmanagement.io");
  }

  // Fix Lori → Laurie with correct email
  const lori = await db.user.findUnique({ where: { email: "lori@ebpublicrelations.com" } });
  if (lori) {
    await db.user.update({ where: { id: lori.id }, data: { name: "Laurie", email: "ebmaccounting@ebmanagement.io" } });
    changes.push("Lori → Laurie (ebmaccounting@ebmanagement.io)");
  }

  // Delete Michel
  const michel = await db.user.findUnique({ where: { email: "michel@ebpublicrelations.com" } });
  if (michel) {
    await db.user.delete({ where: { id: michel.id } });
    changes.push("Deleted Michel Suarez");
  }

  return NextResponse.json({ message: "Team updated", changes });
}
