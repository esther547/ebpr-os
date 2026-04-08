import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: view signature status
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const signature = await db.contractSignature.findUnique({
    where: { token },
    include: {
      contract: {
        select: { id: true, title: true, client: { select: { name: true } } },
      },
    },
  });

  if (!signature) {
    return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
  }

  // Mark as viewed
  if (!signature.viewedAt) {
    await db.contractSignature.update({
      where: { token },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  return NextResponse.json({
    data: {
      signerName: signature.signerName,
      contractTitle: signature.contract.title,
      clientName: signature.contract.client.name,
      status: signature.status,
      signedAt: signature.signedAt,
    },
  });
}

// POST: sign the contract
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const signature = await db.contractSignature.findUnique({
    where: { token },
    include: { contract: true },
  });

  if (!signature) {
    return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
  }

  if (signature.status === "SIGNED") {
    return NextResponse.json({ error: "Already signed" }, { status: 400 });
  }

  // Get IP from headers
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // Sign the contract
  await db.contractSignature.update({
    where: { token },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
      ipAddress: ip,
    },
  });

  // Update the contract status to SIGNED
  await db.contract.update({
    where: { id: signature.contractId },
    data: { status: "SIGNED", signedAt: new Date() },
  });

  return NextResponse.json({ message: "Contract signed successfully" });
}
