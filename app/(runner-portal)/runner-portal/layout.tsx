/**
 * The (runner-portal) layout already renders the portal chrome (logo, title,
 * user menu) via PortalShell — this segment adds no header of its own so the
 * portal never shows two stacked headers.
 */
export default function RunnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
