"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";

const ROW_COLORS = new Set(["blue", "green", "pink", "purple", "yellow", "cyan", "white"]);

/**
 * Finance spreadsheet row color. Lives here (not /api/clients) because FINANCE
 * may recolor rows but may not otherwise manage clients.
 */
export async function setClientRowColor(
  clientId: string,
  color: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser().catch(() => null);
  if (!user || !canManageFinance(user)) return { ok: false, error: "Forbidden" };
  if (color !== null && !ROW_COLORS.has(color)) return { ok: false, error: "Invalid color" };

  try {
    await db.client.update({ where: { id: clientId }, data: { rowColor: color } });
  } catch {
    return { ok: false, error: "Client not found" };
  }
  revalidatePath("/finance");
  return { ok: true };
}
