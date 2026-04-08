import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readGoogleDoc, parseStrategyToTasks } from "@/lib/google-docs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const user = await requireUser();
  if (!canManageTasks(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;

  // Get client's strategy doc URL
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, strategyDocUrl: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.strategyDocUrl) {
    return NextResponse.json({ error: "No strategy document linked. Add a Google Doc URL first." }, { status: 400 });
  }

  try {
    // Read the Google Doc
    const docText = await readGoogleDoc(client.strategyDocUrl);

    if (!docText.trim()) {
      return NextResponse.json({ error: "Document is empty or could not be read. Make sure the document is shared with ebpr-docs@ebpr-492704.iam.gserviceaccount.com" }, { status: 400 });
    }

    // Parse into tasks
    const parsedTasks = parseStrategyToTasks(docText);

    if (parsedTasks.length === 0) {
      return NextResponse.json({
        error: "Could not find actionable items in the document. Make sure the strategy has bullet points or numbered items.",
        docPreview: docText.substring(0, 500),
      }, { status: 400 });
    }

    // Create tasks in the database
    let created = 0;
    for (const task of parsedTasks) {
      // Check if a similar task already exists for this client
      const existing = await db.task.findFirst({
        where: {
          clientId,
          title: task.title,
        },
      });

      if (!existing) {
        await db.task.create({
          data: {
            clientId,
            title: task.title,
            description: task.description || null,
            status: "TODO",
            priority: "MEDIUM",
            createdById: user.id,
          },
        });
        created++;
      }
    }

    // Log the import
    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "strategy_imported",
        description: `Imported ${created} tasks from strategy document`,
      },
    });

    return NextResponse.json({
      message: `Successfully imported ${created} tasks from strategy document`,
      totalFound: parsedTasks.length,
      created,
      skippedDuplicates: parsedTasks.length - created,
    });
  } catch (err: any) {
    console.error("Strategy import error:", err);

    if (err.message?.includes("not found")) {
      return NextResponse.json({
        error: "Could not access the document. Make sure it's shared with ebpr-docs@ebpr-492704.iam.gserviceaccount.com (Viewer access)",
      }, { status: 403 });
    }

    return NextResponse.json({
      error: err.message || "Failed to import strategy",
    }, { status: 500 });
  }
}
