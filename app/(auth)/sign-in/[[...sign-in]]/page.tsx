import { SignIn } from "@clerk/nextjs";
import { EBPRLogo } from "@/components/brand/ebpr-logo";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <EBPRLogo variant="full" size="lg" />
        </div>

        {/* Sign In */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border border-border rounded-lg bg-white",
              headerTitle: "text-ink-primary font-bold",
              headerSubtitle: "text-ink-secondary",
              formButtonPrimary:
                "bg-ink-primary hover:bg-ink-primary/90 text-white rounded-md",
              formFieldInput:
                "border-border rounded-md focus:ring-ink-primary focus:border-ink-primary",
              footerActionLink: "text-ink-primary hover:underline",
            },
          }}
        />
      </div>
    </div>
  );
}
