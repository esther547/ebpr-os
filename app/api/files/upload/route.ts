import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string;
    const deliverableId = formData.get("deliverableId") as string | null;
    const campaignId = formData.get("campaignId") as string | null;
    const isClientVisible = formData.get("isClientVisible") === "true";

    if (!file || !clientId) {
      return NextResponse.json(
        { error: "Missing file or clientId" },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop();
    const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, file);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    const dbFile = await db.file.create({
      data: {
        clientId,
        deliverableId: deliverableId || undefined,
        campaignId: campaignId || undefined,
        uploadedById: user.id,
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
        mimeType: file.type,
        isClientVisible,
        tags: [],
      },
    });

    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "file_uploaded",
        description: `Uploaded file "${file.name}"`,
      },
    });

    return NextResponse.json({ data: dbFile }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
