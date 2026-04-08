import { google } from "googleapis";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });
}

export function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function readGoogleDoc(docUrl: string): Promise<string> {
  const docId = extractDocId(docUrl);
  if (!docId) throw new Error("Invalid Google Docs URL");

  const auth = getAuth();
  const docs = google.docs({ version: "v1", auth });
  const response = await docs.documents.get({ documentId: docId });
  const doc = response.data;

  if (!doc.body?.content) return "";

  let text = "";
  for (const element of doc.body.content) {
    if (element.paragraph?.elements) {
      for (const e of element.paragraph.elements) {
        if (e.textRun?.content) text += e.textRun.content;
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
                if (e.textRun?.content) cellText += e.textRun.content.trim();
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

// ─── Enhanced Task Parser ────────────────────────────────

type ParsedTask = {
  title: string;
  description?: string;
  category?: string;
  type?: string; // maps to DeliverableType
  priority?: string;
};

const TYPE_KEYWORDS: Record<string, string[]> = {
  PRESS_PLACEMENT: ["press", "article", "coverage", "feature", "publication", "magazine", "newspaper", "editorial", "media placement"],
  INTERVIEW: ["interview", "entrevista", "Q&A", "podcast", "radio", "TV", "television", "talk show"],
  INFLUENCER_COLLAB: ["influencer", "collaboration", "collab", "partnership", "creator", "tiktoker", "youtuber"],
  EVENT_APPEARANCE: ["event", "evento", "appearance", "red carpet", "alfombra", "gala", "premiere", "launch", "festival", "award"],
  BRAND_OPPORTUNITY: ["brand", "marca", "sponsorship", "endorsement", "ambassador", "deal"],
  SOCIAL_MEDIA: ["social", "instagram", "tiktok", "reel", "post", "story", "content"],
  PRESS_RELEASE: ["press release", "comunicado", "announcement", "nota de prensa"],
};

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  HIGH: ["urgent", "urgente", "important", "priority", "ASAP", "deadline", "immediately", "critical", "key", "top"],
  LOW: ["optional", "nice to have", "if possible", "eventually", "later", "backlog"],
};

function detectType(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return type;
  }
  return undefined;
}

function detectPriority(text: string): string {
  const lower = text.toLowerCase();
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return priority;
  }
  return "MEDIUM";
}

export function parseStrategyToTasks(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentSection = "";

  for (const line of lines) {
    if (line.length < 3) continue;

    // Detect section headers
    const isHeader =
      (line === line.toUpperCase() && line.length > 3 && line.length < 80 && !/^\d/.test(line)) ||
      line.endsWith(":");

    if (isHeader) {
      currentSection = line.replace(/:$/, "").trim();
      continue;
    }

    // Detect bullet points, numbered items, dashes, arrows, table rows
    const bulletMatch = line.match(/^[\-\•\*\→\➜\►\○\●\✓\☐\☑]\s*(.+)/);
    const numberedMatch = line.match(/^\d+[\.\)]\s*(.+)/);
    const dashMatch = line.match(/^[–—]\s*(.+)/);
    const tableMatch = line.includes("|") ? line.split("|").map((c) => c.trim()).filter((c) => c.length > 3) : null;

    let content = bulletMatch?.[1] || numberedMatch?.[1] || dashMatch?.[1];

    // Also try table cells as individual items
    if (!content && tableMatch && tableMatch.length > 0) {
      for (const cell of tableMatch) {
        if (cell.length > 5 && cell.length < 200) {
          tasks.push({
            title: cell,
            description: currentSection ? `From: ${currentSection}` : undefined,
            category: currentSection || undefined,
            type: detectType(cell),
            priority: detectPriority(cell),
          });
        }
      }
      continue;
    }

    if (content && content.length > 5 && content.length < 200) {
      tasks.push({
        title: content,
        description: currentSection ? `From: ${currentSection}` : undefined,
        category: currentSection || undefined,
        type: detectType(content),
        priority: detectPriority(content),
      });
    }
  }

  // If no structured items found, try action-oriented lines
  if (tasks.length === 0) {
    const actionWords = /^(contact|reach out|send|schedule|pitch|create|draft|prepare|follow up|secure|confirm|coordinate|book|arrange|submit|post|publish|review|call|email|set up|organize|plan|enviar|contactar|preparar|coordinar|agendar)/i;
    for (const line of lines) {
      if (line.length > 10 && line.length < 200 && actionWords.test(line)) {
        tasks.push({
          title: line,
          type: detectType(line),
          priority: detectPriority(line),
        });
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
