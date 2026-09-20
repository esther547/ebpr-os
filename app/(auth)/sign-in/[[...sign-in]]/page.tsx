import { SignIn } from "@clerk/nextjs";
import { AuthShell, clerkAppearance } from "../../auth-shell";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell footnote="Access is by invitation. If your email has not been added by Esther, you will see an access-pending screen after signing in.">
      <SignIn appearance={clerkAppearance} />
    </AuthShell>
  );
}
