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

  // Fix runner emails
  const juan = await db.user.findUnique({ where: { email: "juan@ebpublicrelations.com" } });
  if (juan) {
    await db.user.update({ where: { id: juan.id }, data: { email: "jdesedag@gmail.com" } });
    changes.push("Juan → jdesedag@gmail.com");
  }

  const julieta = await db.user.findUnique({ where: { email: "julieta@ebpublicrelations.com" } });
  if (julieta) {
    await db.user.update({ where: { id: julieta.id }, data: { email: "julietacespedes@gmail.com" } });
    changes.push("Julieta → julietacespedes@gmail.com");
  }

  const eliana = await db.user.findUnique({ where: { email: "eliana@ebpublicrelations.com" } });
  if (eliana) {
    await db.user.update({ where: { id: eliana.id }, data: { email: "elianaebpublicrelations@gmail.com" } });
    changes.push("Eliana → elianaebpublicrelations@gmail.com");
  }

  const valentina = await db.user.findUnique({ where: { email: "valentina@ebpublicrelations.com" } });
  if (valentina) {
    await db.user.update({ where: { id: valentina.id }, data: { email: "vyou.prmarketing@gmail.com" } });
    changes.push("Valentina → vyou.prmarketing@gmail.com");
  }

  return NextResponse.json({ message: "Team updated", changes });
}
