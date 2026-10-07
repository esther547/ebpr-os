import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { visibleContactTabs } from "@/lib/contact-lists";

export default async function ContactosPage() {
  const user = await requireUser();
  const tabs = visibleContactTabs(user);
  redirect(tabs[0]?.href ?? "/dashboard");
}
