import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { isStorageConfigured, uploadFile } from "@/lib/supabase";

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "File storage is not configured on this server (Supabase keys missing)." },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const clientId = formData.get("clientId");
    const deliverableId = formData.get("deliverableId");
    const campaignId = formData.get("campaignId");
    const isClientVisible = formData.get("isClientVisible") === "true";

    if (!(file instanceof File) || typeof clientId !== "string" || !clientId) {
      return NextResponse.json({ error: "Missing file or clientId" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { url, error: uploadError } = await uploadFile(file, path);
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 502 });
    }

    const dbFile = await db.file.create({
      data: {
        clientId,
        deliverableId: typeof deliverableId === "string" && deliverableId ? deliverableId : undefined,
        campaignId: typeof campaignId === "string" && campaignId ? campaignId : undefined,
        uploadedById: user.id,
        name: file.name,
        url,
        size: file.size,
        mimeType: file.type || null,
        isClientVisible,
        tags: [],
      },
    });

    await db.activityLog.create({
      data: {
        clientId,
        deliverableId: dbFile.deliverableId,
        userId: user.id,
        action: "file_uploaded",
        description: `Uploaded file "${file.name}"`,
      },
    });

    return NextResponse.json({ data: dbFile }, { status: 201 });
  } catch (err) {
    console.error("POST /api/files/upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
