import { NavTabs } from "@/components/ui/tabs";

/** Sub-navigation of the Contactos tab: one link per database the user may open. */
export function ContactsTabs({ tabs, current }: { tabs: { href: string; label: string }[]; current: string }) {
  if (tabs.length <= 1) return null;
  return <NavTabs items={tabs} current={current} className="mb-6" />;
}
