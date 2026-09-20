import { redirect } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";

export const metadata = { title: "Section paused" };
export const dynamic = "force-dynamic";

/** Landing page for roles whose sections (Legal / Follow-Up) are switched off for now. */
export default async function PausedPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.role === "SUPER_ADMIN" || user.role === "STRATEGIST") redirect("/dashboard");
  if (user.role === "RUNNER") redirect("/runner-portal");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 px-6">
      <div className="page-enter w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
        <div className="mb-6 flex justify-center"><EBPRLogoHorizontal size="sm" /></div>
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
          <PauseCircle className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-ink-primary">This section is paused for now</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Hi {user.name.split(" ")[0]}. The contracts and follow-up area is switched off while the team
          focuses on goals, agendas and runner scheduling. Esther will let you know when it is back.
        </p>
      </div>
    </div>
  );
}
