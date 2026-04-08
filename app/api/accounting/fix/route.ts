import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  const results: string[] = [];

  // Fix Ana Velez invoices under Ana Estela
  const anaVelez = await db.client.findFirst({
    where: { name: { contains: "Ana Velez", mode: "insensitive" } },
  });

  if (anaVelez) {
    // Move invoices with "VELE" in invoice number to Ana Velez
    const moved = await db.invoice.updateMany({
      where: {
        invoiceNumber: { contains: "VELE" },
        clientId: { not: anaVelez.id },
      },
      data: { clientId: anaVelez.id },
    });
    results.push(`Moved ${moved.count} Ana Velez invoices`);

    // Also move any contracts that belong to Ana Velez
    const anaVelezContract = await db.contract.findFirst({
      where: {
        clientId: { not: anaVelez.id },
        notes: { contains: "Ana Velez", mode: "insensitive" },
      },
    });
    if (anaVelezContract) {
      await db.contract.update({
        where: { id: anaVelezContract.id },
        data: { clientId: anaVelez.id },
      });
      results.push("Moved Ana Velez contract");
    }
  } else {
    results.push("Ana Velez client not found");
  }

  // Fix Fer Ariza — check if contract is shared with Daniela Fernandez
  const ferAriza = await db.client.findFirst({
    where: { name: { contains: "Fer Ariza", mode: "insensitive" } },
  });
  if (ferAriza) {
    const ferContract = await db.contract.findFirst({ where: { clientId: ferAriza.id } });
    if (!ferContract) {
      // Create a contract for Fer Ariza
      await db.contract.create({
        data: {
          clientId: ferAriza.id,
          title: "Fer Ariza — PR Services (Month to Month)",
          status: "SIGNED",
          value: 4500,
          startDate: new Date("2026-01-10"),
          notes: "Term: Month to Month. Bill to: Beto Music, S.A.S",
          billingReady: true,
          signedAt: new Date("2026-01-10"),
        },
      });
      results.push("Created Fer Ariza contract");
    }
  }

  return NextResponse.json({ success: true, results });
}
