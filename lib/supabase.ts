import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "ebpr-files";

/** True when the server has everything it needs to talk to Supabase storage. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let _admin: SupabaseClient | null = null;
let _public: SupabaseClient | null = null;

/**
 * Server-side client (service role). Created lazily so a missing env var surfaces as a
 * clear error at request time instead of crashing every route that imports this module.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "File storage is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)."
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/** Browser/anon client (limited permissions). */
export function getSupabase(): SupabaseClient {
  if (_public) return _public;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).");
  }
  _public = createClient(url, key);
  return _public;
}

/** Translate storage/network failures into something a user can act on. */
export function storageErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/not configured/i.test(msg)) return msg;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) {
    return "Could not reach file storage. Check the Supabase URL and network connection.";
  }
  if (/invalid.*(api key|jwt)|unauthorized|401|403/i.test(msg)) {
    return "File storage rejected the request. Check the Supabase service role key.";
  }
  if (/bucket.*not found/i.test(msg)) {
    return `Storage bucket "${STORAGE_BUCKET}" does not exist in Supabase.`;
  }
  return msg ? `Upload failed: ${msg}` : "Upload failed.";
}

export async function uploadFile(
  file: File,
  path: string,
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {}
): Promise<{ url: string; path: string; error: Error | null }> {
  try {
    const admin = getSupabaseAdmin();
    const upload = admin.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Upload timed out. File storage did not respond.")), timeoutMs)
    );
    const { data, error } = await Promise.race([upload, timeout]);
    if (error) return { url: "", path: "", error: new Error(storageErrorMessage(error.message)) };

    const { data: urlData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
    return { url: urlData.publicUrl, path: data.path, error: null };
  } catch (err) {
    return { url: "", path: "", error: new Error(storageErrorMessage(err)) };
  }
}

export async function deleteFile(path: string): Promise<void> {
  await getSupabaseAdmin().storage.from(STORAGE_BUCKET).remove([path]);
}
