"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, Input, FormGroup } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

/** Settings → Correo: paste a new Gmail app password; it is checked, saved encrypted and used at once. */
export function MailSettingsCard({ sender, source, updatedAt }: { sender: string | null; source: "db" | "env" | "none"; updatedAt: string | null }) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState({ source, updatedAt });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/settings/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appPassword: value }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: d?.error ?? "No se pudo guardar", variant: "error" }); return; }
      setValue(""); setState({ source: "db", updatedAt: new Date().toISOString() });
      toast({ title: "Correo activo de nuevo", description: d.testSent ? `Te mandé una prueba a tu correo desde ${d.sender}.` : "Guardada. La prueba no salió, revisa en un minuto.", variant: "success" });
    } finally { setSaving(false); }
  }
  const status = state.source === "db" ? `Contraseña guardada desde el portal${state.updatedAt ? ` el ${new Date(state.updatedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}` : ""}.` : state.source === "env" ? "Usando la contraseña configurada en Vercel." : "Sin contraseña: el portal no puede enviar correos.";
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 border-b border-border px-5 py-4" eyebrow="Correo" title={`Cuenta que envía: ${sender ?? "no configurada"}`} description="Agendas, avisos a runners, invitaciones y comunicados salen desde esta cuenta de Gmail." />
      <form onSubmit={save} className="space-y-3 p-5">
        <p className="text-sm text-ink-secondary">{status}</p>
        <FormGroup label="Nueva contraseña de aplicación de Gmail" htmlFor="mail-pass" description="En Google: myaccount.google.com → Seguridad → Contraseñas de aplicaciones → crear una para «EBPR OS». Pégala aquí (con o sin espacios). Se guarda cifrada y nunca se muestra.">
          <Input id="mail-pass" type="password" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
        </FormGroup>
        <Button type="submit" loading={saving} disabled={value.replace(/\s/g, "").length < 8} leftIcon={<Mail className="h-4 w-4" />}>Guardar y probar</Button>
      </form>
    </Card>
  );
}
