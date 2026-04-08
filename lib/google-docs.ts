import { google } from "googleapis";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });
}

/**
 * Extract the document ID from a Google Docs URL
 * Supports: https://docs.google.com/document/d/DOCUMENT_ID/edit
 */
export function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Read a Google Doc and return its text content
 */
export async function readGoogleDoc(docUrl: string): Promise<string> {
  const docId = extractDocId(docUrl);
  if (!docId) throw new Error("Invalid Google Docs URL");

  const auth = getAuth();
  const docs = google.docs({ version: "v1", auth });

  const response = await docs.documents.get({ documentId: docId });
  const doc = response.data;

  if (!doc.body?.content) return "";

  // Extract all text from the document
  let text = "";
  for (const element of doc.body.content) {
    if (element.paragraph?.elements) {
      for (const e of element.paragraph.elements) {
        if (e.textRun?.content) {
          text += e.textRun.content;
        }
      }
    }
    if (element.table) {
      for (const row of element.table.tableRows || []) {
        const cells: string[] = [];
        for (const cell of row.tableCells || []) {
          let cellText = "";
          for (const content of cell.content || []) {
            if (content.paragraph?.elements) {
              for (const e of content.paragraph.elements) {
                if (e.textRun?.content) {
                  cellText += e.textRun.content.trim();
                }
              }
            }
          }
          cells.push(cellText);
        }
        text += cells.join(" | ") + "\n";
      }
    }
  }

  return text;
}

/**
 * Parse strategy document text into task items
 * Looks for bullet points, numbered items, headers, and action items
 */
export function parseStrategyToTasks(text: string): { title: string; description?: string }[] {
  const tasks: { title: string; description?: string }[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentSection = "";

  for (const line of lines) {
    // Skip very short lines or header-only lines
    if (line.length < 3) continue;

    // Detect section headers (all caps, or starts with #, or has colon at end)
    const isHeader =
      line === line.toUpperCase() && line.length > 3 && line.length < 80 && !/^\d/.test(line);
    const isColonHeader = line.endsWith(":") && line.length < 80;

    if (isHeader || isColonHeader) {
      currentSection = line.replace(/:$/, "").trim();
      continue;
    }

    // Detect bullet points, numbered items, dashes, arrows
    const bulletMatch = line.match(/^[\-\•\*\→\➜\►\○\●]\s*(.+)/);
    const numberedMatch = line.match(/^\d+[\.\)]\s*(.+)/);
    const dashMatch = line.match(/^[–—]\s*(.+)/);

    const content = bulletMatch?.[1] || numberedMatch?.[1] || dashMatch?.[1];

    if (content && content.length > 5 && content.length < 200) {
      tasks.push({
        title: content,
        description: currentSection ? `From: ${currentSection}` : undefined,
      });
    }
  }

  // If no bullet points found, try splitting by lines that look like action items
  if (tasks.length === 0) {
    for (const line of lines) {
      if (line.length > 10 && line.length < 200) {
        // Look for action-oriented lines
        const actionWords = /^(contact|reach out|send|schedule|pitch|create|draft|prepare|follow up|secure|confirm|coordinate|book|arrange|submit|post|publish|review)/i;
        if (actionWords.test(line)) {
          tasks.push({ title: line });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const key = t.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
