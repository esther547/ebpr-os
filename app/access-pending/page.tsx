import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { Lock } from "lucide-react";
import { getCurrentUser, getCurrentClientUser, ROLE_HOME } from "@/lib/auth";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";

export const metadata = { title: "Access pending" };
export const dynamic = "force-dynamic";

export default async function AccessPendingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(ROLE_HOME[user.role]);
  const clientUser = await getCurrentClientUser().catch(() => null);
  if (clientUser) redirect("/portal");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 px-6">
      <div className="page-enter w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
        <div className="mb-6 flex justify-center">
          <EBPRLogoHorizontal size="sm" />
        </div>
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-ink-primary">Your account is not set up yet</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          You signed in successfully, but this email has not been added to the EBPR team.
          Ask Esther to add your email under Settings, then sign in again with that address.
        </p>
        <div className="mt-6">
          <SignOutButton redirectUrl="/sign-in">
            <button className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-ink-primary shadow-sm hover:bg-surface-2">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
