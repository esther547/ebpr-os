import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/sign-in");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
      />
      <main className="ml-[220px] flex-1 min-w-0">
        <div className="mx-auto max-w-7xl px-6 pb-16">
          {children}
        </div>
      </main>
    </div>
  );
}
