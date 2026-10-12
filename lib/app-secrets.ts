/**
 * Secrets the admin can change from the portal (Settings), stored encrypted in the database so a new
 * Gmail app password does not require touching Vercel or redeploying (Esther, Oct 12 2026).
 * Encryption: AES-256-GCM with a key derived from APP_SECRET (or CRON_SECRET). Rotating that key makes
 * stored secrets unreadable: re-enter them in Settings afterwards.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

function key(): Buffer {
  const base = process.env.APP_SECRET || process.env.CRON_SECRET || "ebpr-os-local-dev";
  return createHash("sha256").update(base).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(blob: string): string | null {
  try {
    const buf = Buffer.from(blob, "base64");
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const cache = new Map<string, { value: string | null; at: number }>();
const TTL = 30_000;

/** Stored secret (decrypted) or null; cached briefly per instance. */
export async function getStoredSecret(id: string): Promise<string | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const row = await db.appSetting.findUnique({ where: { id }, select: { value: true } }).catch(() => null);
  const value = row ? decryptSecret(row.value) : null;
  cache.set(id, { value, at: Date.now() });
  return value;
}

export async function setStoredSecret(id: string, plain: string, updatedById?: string | null): Promise<void> {
  await db.appSetting.upsert({ where: { id }, create: { id, value: encryptSecret(plain), updatedById: updatedById ?? null }, update: { value: encryptSecret(plain), updatedById: updatedById ?? null } });
  cache.set(id, { value: plain, at: Date.now() });
}

export async function secretInfo(id: string): Promise<{ source: "db" | "env" | "none"; updatedAt: Date | null }> {
  const row = await db.appSetting.findUnique({ where: { id }, select: { updatedAt: true } }).catch(() => null);
  if (row) return { source: "db", updatedAt: row.updatedAt };
  return { source: process.env[id] ? "env" : "none", updatedAt: null };
}

/** The Gmail app password of the sender account: the one saved in Settings wins over the env var. */
export async function getMailPassword(): Promise<string | null> {
  return (await getStoredSecret("GMAIL_APP_PASSWORD")) || process.env.GMAIL_APP_PASSWORD || null;
}
