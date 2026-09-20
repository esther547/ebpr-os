"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/form-field";

export function PrintButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      className={className}
      onClick={() => window.print()}
      leftIcon={<Printer className="h-3.5 w-3.5" />}
    >
      Print / Export PDF
    </Button>
  );
}
