"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Regenerates the client's "Agenda 2026" Google Doc from the portal on demand.
 * The same job runs nightly from /api/cron — this is the "do it now" button.
 */
export function SyncDocButton({
  clientId,
  hasDoc,
}: {
  clientId: string;
  hasDoc: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!hasDoc) {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        title="Agrega el link del Doc en la ficha del cliente"
        leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
      >
        Actualizar Google Doc
      </Button>
    );
  }

  async function sync() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/agenda/export-doc`, { method: "POST" });
      const data: { ok?: boolean; message?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.ok) {
        toast({
          title: data.message || "Google Doc actualizado",
          variant: "success",
        });
      } else {
        toast({
          title: "No se pudo actualizar el Google Doc",
          description: data.error || `Error ${res.status}`,
          variant: "error",
        });
      }
    } catch (err) {
      toast({
        title: "No se pudo actualizar el Google Doc",
        description: err instanceof Error ? err.message : "Error de red",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={sync}
      loading={loading}
      leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
    >
      Actualizar Google Doc
    </Button>
  );
}
