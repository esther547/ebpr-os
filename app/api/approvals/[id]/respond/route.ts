import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentClientUser } from "@/lib/auth";

const respondSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  comment: z.string().optional(),
});

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const clientUser = await getCurrentClientUser();
    if (!clientUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body =
      req.headers.get("content-type")?.includes("application/json")
        ? await req.json()
        : Object.fromEntries(await req.formData());

    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const approval = await db.approval.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true, title: true },
    });
    if (!approval || approval.clientId !== clientUser.clientId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Create response record
    await db.approvalResponse.create({
      data: {
        approvalId: approval.id,
        clientUserId: clientUser.id,
        status: parsed.data.status,
        comment: parsed.data.comment,
      },
    });

    // Update approval status
    await db.approval.update({
      where: { id: approval.id },
      data: { status: parsed.data.status },
    });

    // For form submissions, redirect back to approvals page
    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.redirect(new URL("/portal/approvals", req.url));
    }

    return NextResponse.json({ data: { status: parsed.data.status } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
