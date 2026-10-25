import { NavTabs } from "@/components/ui/tabs";

/** Shown only to the EBM owners: Brand Deals (everyone on EBM) vs. the private Esther & Benjy section. */
export function EbmTabs({ current, pending }: { current: string; pending?: number }) {
  return <NavTabs items={[{ href: "/ebm", label: "Brand Deals" }, { href: "/ebm/owners", label: "Esther & Benjy", count: pending }]} current={current} className="mt-6" />;
}
