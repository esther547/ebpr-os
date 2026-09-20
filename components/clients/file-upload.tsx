"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/form-field";

const MAX_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 45_000;

interface Props {
  clientId: string;
  deliverableId?: string;
}

/** Upload control with explicit timeout so a misconfigured storage backend never hangs the UI. */
export function FileUpload({ clientId, deliverableId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clientVisible, setClientVisible] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File too large (max 50MB).");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    if (deliverableId) formData.append("deliverableId", deliverableId);
    formData.append("isClientVisible", clientVisible ? "true" : "false");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    setUploading(true);
    try {
      const res = await fetch("/api/files/upload", { method: "POST", body: formData, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Upload failed (${res.status})`);
        return;
      }
      setSuccess(`Uploaded "${file.name}"`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Upload timed out. File storage did not respond — check the Supabase configuration."
          : "Network error — could not reach the server"
      );
    } finally {
      clearTimeout(timer);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          leftIcon={<Upload className="h-3.5 w-3.5" />}
        >
          {uploading ? "Uploading..." : "Upload File"}
        </Button>
        <label className="flex items-center gap-2 text-xs text-ink-secondary">
          <input
            type="checkbox"
            checked={clientVisible}
            onChange={(e) => setClientVisible(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          Visible to client
        </label>
      </div>
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
          {success}
        </div>
      )}
    </div>
  );
}
