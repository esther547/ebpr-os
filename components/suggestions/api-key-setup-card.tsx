import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Shown instead of the generator when ANTHROPIC_API_KEY is not set on the server. */
export function ApiKeySetupCard() {
  const steps = [
    <>Entra a <span className="font-medium text-ink-primary">console.anthropic.com</span> → Settings → API Keys y crea una llave (<span className="font-medium text-ink-primary">Create Key</span>). Copia el valor, empieza con <code className="rounded bg-surface-2 px-1 text-2xs">sk-ant-</code>.</>,
    <>En Vercel abre el proyecto → Settings → Environment Variables y agrega <code className="rounded bg-surface-2 px-1 text-2xs">ANTHROPIC_API_KEY</code> con esa llave para Production (y Preview si lo usan).</>,
    <>Vuelve a desplegar (Deployments → ⋯ → Redeploy) y recarga esta página. El botón &ldquo;Generar sugerencias&rdquo; quedará activo.</>,
  ];
  return (
    <Card padding="md" className="border-accent2/30 bg-accent2-soft/40">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 hidden h-8 w-8 shrink-0 sm:flex items-center justify-center rounded-full bg-white text-accent2-ink ring-1 ring-accent2/20">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Falta la llave de Anthropic (ANTHROPIC_API_KEY) en Vercel</p>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Las sugerencias las escribe Claude a partir del perfil del cliente. Sin la llave no se pueden generar nuevas; las que ya existen se pueden seguir gestionando.
            </p>
          </div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-ink-secondary">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-primary text-2xs font-semibold text-white tabular">{i + 1}</span>
                <span className="min-w-0">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
