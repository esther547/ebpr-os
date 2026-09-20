"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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
  const [dragging, setDragging] = useState(false);
  const [clientVisible, setClientVisible] = useState(false);
  const { toast } = useToast();

  async function handleFile(file: File) {
    if (file.size === 0) {
      toast({ title: "That file is empty.", variant: "error" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Maximum size is 50MB.", variant: "error" });
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
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Upload failed",
          description: typeof data.error === "string" ? data.error : `Request failed (${res.status})`,
          variant: "error",
        });
        return;
      }
      toast({ title: `Uploaded "${file.name}"`, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Upload failed",
        description:
          err instanceof DOMException && err.name === "AbortError"
            ? "Upload timed out. File storage did not respond — check the Supabase configuration."
            : "Network error — could not reach the server",
        variant: "error",
      });
    } finally {
      clearTimeout(timer);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void handleFile(f);
      }}
      className={cn(
        "rounded-xl border border-dashed bg-white/60 px-6 py-8 text-center transition-colors",
        dragging ? "border-ink-primary bg-surface-2" : "border-border"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
        <Upload className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-ink-primary">Drop a file here</p>
      <p className="mt-1 text-sm text-ink-muted">Contracts, assets, or coverage. Up to 50MB.</p>

      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button onClick={() => inputRef.current?.click()} loading={uploading} variant="secondary" size="sm">
          Choose File
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
    </div>
  );
}
