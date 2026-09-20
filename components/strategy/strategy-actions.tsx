"use client";

import { useState } from "react";
import { CreateStrategyItemModal } from "./create-strategy-item-modal";

export function StrategyAddItemButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors"
      >
        + Add Item
      </button>
      <CreateStrategyItemModal open={open} onOpenChange={setOpen} clientId={clientId} />
    </>
  );
}
