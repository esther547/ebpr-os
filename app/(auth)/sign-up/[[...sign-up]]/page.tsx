import { SignUp } from "@clerk/nextjs";
import { AuthShell, clerkAppearance } from "../../auth-shell";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell footnote="Use the same email address Esther added for you in EBPR OS. Other addresses will not be granted access.">
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}
