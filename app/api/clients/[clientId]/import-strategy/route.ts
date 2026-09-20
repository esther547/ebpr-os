import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readGoogleDoc, parseStrategyToTasks, isGoogleDocsConfigured, GOOGLE_NOT_CONFIGURED } from "@/lib/google-docs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageTasks(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, strategyDocUrl: true },
  });

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.strategyDocUrl) {
    return NextResponse.json({ error: "No strategy document linked. Add a Google Doc URL first." }, { status: 400 });
  }
  if (!isGoogleDocsConfigured()) {
    return NextResponse.json({ error: GOOGLE_NOT_CONFIGURED }, { status: 503 });
  }

  try {
    const docText = await readGoogleDoc(client.strategyDocUrl);

    if (!docText.trim()) {
      return NextResponse.json({ error: "Document is empty or could not be read. Make sure the document is shared with ebpr-docs@ebpr-492704.iam.gserviceaccount.com" }, { status: 400 });
    }

    const parsedTasks = parseStrategyToTasks(docText);

    if (parsedTasks.length === 0) {
      return NextResponse.json({
        error: "Could not find actionable items in the document. Make sure the strategy has bullet points, numbered items, or action-oriented text.",
        docPreview: docText.substring(0, 500),
      }, { status: 400 });
    }

    let created = 0;
    const imported: string[] = [];

    for (const task of parsedTasks) {
      const existing = await db.task.findFirst({
        where: { clientId, title: task.title },
      });

      if (!existing) {
        await db.task.create({
          data: {
            clientId,
            title: task.title,
            description: [
              task.description,
              task.type ? `Type: ${task.type}` : null,
              task.category ? `Category: ${task.category}` : null,
            ].filter(Boolean).join("\n"),
            status: "TODO",
            priority: (task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
            createdById: user.id,
          },
        });
        created++;
        imported.push(task.title);
      }
    }

    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "strategy_imported",
        description: `Imported ${created} tasks from strategy document (${parsedTasks.length} found, ${parsedTasks.length - created} duplicates skipped)`,
      },
    });

    return NextResponse.json({
      message: `Successfully imported ${created} tasks from strategy document`,
      totalFound: parsedTasks.length,
      created,
      skippedDuplicates: parsedTasks.length - created,
      imported,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Strategy import error:", err);

    if (message === GOOGLE_NOT_CONFIGURED || /Invalid Google Docs URL/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (/invalid_grant|invalid_client|DECODER|PEM|private key/i.test(message)) {
      return NextResponse.json({ error: "Google service account credentials are invalid. Check GOOGLE_SERVICE_ACCOUNT_KEY." }, { status: 503 });
    }
    if (/ENOTFOUND|ECONNREFUSED|fetch failed|network|ETIMEDOUT/i.test(message)) {
      return NextResponse.json({ error: "Could not reach Google Docs. Check the network connection and try again." }, { status: 502 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({
        error: "Could not access the document. Make sure it's shared with ebpr-docs@ebpr-492704.iam.gserviceaccount.com (Viewer access)",
      }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
