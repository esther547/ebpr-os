/**
 * Secrets the admin can change from the portal (Settings), stored encrypted in the database so a new
 * Gmail app password does not require touching Vercel or redeploying (Esther, Oct 12 2026).
 * Encryption: AES-256-GCM with a key derived from APP_SECRET (or CRON_SECRET). Rotating that key makes
 * stored secrets unreadable: re-enter them in Settings afterwards.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

/** Primary key (APP_SECRET) plus fallbacks, so values encrypted under an older key still open and get re-encrypted. */
function keys(): Buffer[] {
  const bases = [process.env.APP_SECRET, process.env.CRON_SECRET, "ebpr-os-local-dev"].filter((b): b is string => !!b);
  return bases.map((b) => createHash("sha256").update(b).digest());
}
const primaryKey = () => keys()[0];

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", primaryKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

/** Decrypts with the first key that works; `stale` = it needed a fallback key (re-encrypt it). */
export function decryptSecret(blob: string): { value: string; stale: boolean } | null {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
  for (const [i, k] of keys().entries()) {
    try {
      const d = createDecipheriv("aes-256-gcm", k, iv);
      d.setAuthTag(tag);
      return { value: Buffer.concat([d.update(enc), d.final()]).toString("utf8"), stale: i > 0 };
    } catch { /* next key */ }
  }
  return null;
}

const cache = new Map<string, { value: string | null; at: number }>();
const TTL = 30_000;

/** Stored secret (decrypted) or null; cached briefly per instance. */
export async function getStoredSecret(id: string): Promise<string | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const row = await db.appSetting.findUnique({ where: { id }, select: { value: true } }).catch(() => null);
  const dec = row ? decryptSecret(row.value) : null;
  const value = dec?.value ?? null;
  // Opened with an older key: store it again under the current one so key rotation can finish.
  if (dec?.stale && value) await db.appSetting.update({ where: { id }, data: { value: encryptSecret(value) } }).catch(() => undefined);
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
