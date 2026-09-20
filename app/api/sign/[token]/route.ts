import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: view signature status
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;

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
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;

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
  if (signature.contract.status === "TERMINATED" || signature.contract.status === "EXPIRED") {
    return NextResponse.json({ error: "This contract is no longer open for signature" }, { status: 400 });
  }

  // Get IP from headers
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Sign the contract (both records in one transaction)
  const signedAt = new Date();
  await db.$transaction([
    db.contractSignature.update({
      where: { token },
      data: { status: "SIGNED", signedAt, ipAddress: ip },
    }),
    db.contract.update({
      where: { id: signature.contractId },
      data: { status: "SIGNED", signedAt },
    }),
  ]);

  return NextResponse.json({ message: "Contract signed successfully" });
}
