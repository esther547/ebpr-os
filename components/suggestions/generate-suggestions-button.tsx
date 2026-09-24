"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button, Select } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { GENERATING_EVENT, type GeneratingDetail } from "./types";

/**
 * "Generar sugerencias": asks Claude for a new batch. With `withMode`, a small
 * select picks between adding to the current suggestions or replacing the new ones.
 */
export function GenerateSuggestionsButton({
  clientId,
  clientName,
  withMode = true,
  disabled,
  size = "default",
}: {
  clientId: string;
  clientName: string;
  withMode?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  function announce(active: boolean) {
    window.dispatchEvent(new CustomEvent<GeneratingDetail>(GENERATING_EVENT, { detail: { active, clientName } }));
  }

  async function generate() {
    setLoading(true);
    announce(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/suggestions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace: mode === "replace" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: "No se pudieron generar las sugerencias", description: apiErrorMessage(data, "Intenta de nuevo"), variant: "error", duration: 8000 });
        return;
      }
      const count: number = data?.data?.count ?? 0;
      const replaced: number = data?.data?.replaced ?? 0;
      toast({
        title: `${count} sugerencia${count === 1 ? "" : "s"} nueva${count === 1 ? "" : "s"} para ${clientName}`,
        description: replaced ? `Se descartaron ${replaced} sugerencia${replaced === 1 ? "" : "s"} anterior${replaced === 1 ? "" : "es"}.` : undefined,
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({ title: "No se pudieron generar las sugerencias", description: "Revisa tu conexión e intenta de nuevo", variant: "error" });
    } finally {
      setLoading(false);
      announce(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {withMode && (
        <Select
          aria-label="Qué hacer con las sugerencias nuevas actuales"
          value={mode}
          onChange={(e) => setMode(e.target.value as "add" | "replace")}
          disabled={loading || disabled}
          className={size === "sm" ? "h-8 w-auto pr-8 text-xs" : "w-auto pr-8"}
        >
          <option value="add">Agregar</option>
          <option value="replace">Reemplazar las nuevas</option>
        </Select>
      )}
      <Button
        size={size}
        onClick={generate}
        loading={loading}
        disabled={disabled}
        title={loading ? `Analizando el perfil de ${clientName}… suele tardar entre 20 y 60 segundos` : undefined}
        leftIcon={<Sparkles className="h-4 w-4" />}
      >
        {/* The header copy stays short; the board shows the full "Analizando el perfil de…" card. */}
        {loading ? (size === "sm" ? "Analizando…" : `Analizando el perfil de ${clientName}…`) : "Generar sugerencias"}
      </Button>
    </div>
  );
}
