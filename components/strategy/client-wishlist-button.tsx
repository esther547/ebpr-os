"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage, localDateInputValue } from "@/lib/form-helpers";

/** "+ Wish list cliente": an idea the client called in with, saved to their strategy wishlist. */
export function ClientWishlistButton({ clientId, size = "sm" }: { clientId: string; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const date = (f.get("requestedAt") as string) || localDateInputValue();
    const item = {
      title: (f.get("title") as string).trim(),
      category: (f.get("category") as string) || "OTHER",
      notes: ((f.get("notes") as string) || "").trim() || undefined,
      source: "CLIENT",
      requestedAt: `${date}T12:00:00.000Z`,
      priority: 1,
    };
    try {
      const res = await fetch(`/api/clients/${clientId}/strategy/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: apiErrorMessage(data, "No se pudo guardar la idea"), variant: "error" });
        return;
      }
      toast({ title: "Idea guardada en el wish list del cliente", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "No se pudo guardar la idea", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size={size} variant="secondary" onClick={() => setOpen(true)} leftIcon={<Sparkles className="h-4 w-4" />}>
        Wish list cliente
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Wish list cliente" description="Una idea o pedido que el cliente nos hizo llegar">
        <form onSubmit={submit} className="space-y-4">
          <FormGroup label="Idea" htmlFor="cw-title" required>
            <Input id="cw-title" name="title" placeholder="p. ej. Quiere salir en Vogue México / portada / evento en Madrid" required autoFocus />
          </FormGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormGroup label="Categoría" htmlFor="cw-cat">
              <Select id="cw-cat" name="category" defaultValue="OTHER">
                <option value="OTHER">General</option>
                <option value="MEDIA_TARGET">Medio / prensa</option>
                <option value="INFLUENCER">Creador / colaboración</option>
                <option value="EVENT">Evento</option>
                <option value="BRAND_OPPORTUNITY">Marca</option>
                <option value="POSITIONING">Posicionamiento</option>
              </Select>
            </FormGroup>
            <FormGroup label="Fecha del pedido" htmlFor="cw-date">
              <Input id="cw-date" name="requestedAt" type="date" defaultValue={localDateInputValue()} />
            </FormGroup>
          </div>
          <FormGroup label="Notas" htmlFor="cw-notes" description="Contexto de la llamada, contactos, fechas que mencionó, por qué le importa.">
            <Textarea id="cw-notes" name="notes" rows={3} />
          </FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}
