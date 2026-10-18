import { NavTabs } from "@/components/ui/tabs";

export function TalentsTabs({ current, campaigns }: { current: string; campaigns?: number }) {
  return <NavTabs items={[{ href: "/talentos", label: "Roster" }, { href: "/talentos/campanas", label: "Campañas", count: campaigns }]} current={current} className="mb-6" />;
}
