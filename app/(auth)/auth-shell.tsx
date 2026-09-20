import { EBPRLogo, EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";

/** Shared split layout for sign-in / sign-up. */
export function AuthShell({ children, footnote }: { children: React.ReactNode; footnote?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 0 1px, transparent 1px), radial-gradient(circle at 80% 60%, #fff 0 1px, transparent 1px)",
            backgroundSize: "36px 36px, 52px 52px",
          }}
        />
        <div className="relative">
          <EBPRLogoHorizontal size="md" inverted />
        </div>
        <div className="relative max-w-md">
          <p className="eyebrow !text-white/50">EBPR OS</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
            One place for every client, deliverable, runner, and contract.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Preparation month, monthly execution, and reporting for EB Public Relations, Miami.
          </p>
        </div>
        <p className="relative text-2xs uppercase tracking-[0.2em] text-white/40">
          © {new Date().getFullYear()} EB Public Relations
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <EBPRLogo variant="full" size="md" />
          </div>
          {children}
          {footnote && <p className="mt-6 text-center text-xs text-ink-muted">{footnote}</p>}
        </div>
      </main>
    </div>
  );
}

export const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "shadow-card border border-border rounded-2xl bg-white px-6 py-6",
    headerTitle: "text-ink-primary font-semibold tracking-tight",
    headerSubtitle: "text-ink-secondary",
    socialButtonsBlockButton: "border-border rounded-lg hover:bg-surface-2",
    formButtonPrimary: "bg-ink-primary hover:bg-ink-primary/90 text-white rounded-lg shadow-sm text-sm normal-case",
    formFieldInput: "border-border rounded-lg focus:ring-ink-primary/15 focus:border-ink-primary",
    formFieldLabel: "text-ink-primary",
    footerActionLink: "text-ink-primary hover:underline",
    footer: "hidden",
    dividerLine: "bg-border",
    dividerText: "text-ink-muted",
  },
} as const;
