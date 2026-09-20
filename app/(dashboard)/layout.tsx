import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, canAccessPath, ROLE_HOME } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/access-pending");

  const pathname = headers().get("x-pathname") ?? "";
  if (pathname && !canAccessPath(user.role, pathname)) {
    redirect(ROLE_HOME[user.role]);
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
      />
      <main className="min-w-0 md:ml-[240px]">
        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
