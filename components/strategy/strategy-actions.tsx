"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/form-field";
import { CreateStrategyItemModal } from "./create-strategy-item-modal";

export function StrategyAddItemButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
        Add Item
      </Button>
      <CreateStrategyItemModal open={open} onOpenChange={setOpen} clientId={clientId} />
    </>
  );
}
