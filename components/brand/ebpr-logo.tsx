"use client";

import { cn } from "@/lib/utils";

/**
 * EB Public Relations brand assets (official artwork in /public/brand):
 *  - ebpr-mark.png      the four-circle mark
 *  - ebpr-wordmark.png  "EB PUBLIC RELATIONS"
 *  - ebpr-logo.png      mark + wordmark stacked
 * Black on transparent; `inverted` renders white via CSS invert for dark surfaces.
 */

type EBPRLogoProps = {
  variant?: "mark" | "full" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  inverted?: boolean;
};

const MARK_PX = { sm: 28, md: 40, lg: 64, xl: 96 } as const;
const WORDMARK_H = { sm: 9, md: 11, lg: 14, xl: 18 } as const;

function Img({ src, alt, height, width, inverted, className }: { src: string; alt: string; height: number; width?: number; inverted?: boolean; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      height={height}
      width={width}
      draggable={false}
      className={cn("select-none", inverted && "invert", className)}
      style={{ height, width: width ?? "auto" }}
    />
  );
}

export function EBPRMark({ size = 40, inverted = false, className }: { size?: number; inverted?: boolean; className?: string }) {
  return <Img src="/brand/ebpr-mark.png" alt="EB Public Relations" height={size} width={size} inverted={inverted} className={className} />;
}

export function EBPRLogo({ variant = "full", size = "md", className, inverted = false }: EBPRLogoProps) {
  if (variant === "mark") {
    return (
      <div className={cn("flex items-center", className)}>
        <EBPRMark size={MARK_PX[size]} inverted={inverted} />
      </div>
    );
  }
  if (variant === "wordmark") {
    return (
      <div className={className}>
        <Img src="/brand/ebpr-wordmark.png" alt="EB Public Relations" height={WORDMARK_H[size]} inverted={inverted} />
      </div>
    );
  }
  // full: official stacked lockup
  const h = { sm: 72, md: 110, lg: 160, xl: 220 }[size];
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Img src="/brand/ebpr-logo.png" alt="EB Public Relations" height={h} inverted={inverted} />
    </div>
  );
}

// Horizontal variant (mark + wordmark side by side) — used in sidebar and portal headers
export function EBPRLogoHorizontal({
  size = "md",
  className,
  inverted = false,
  showText = true,
}: Omit<EBPRLogoProps, "variant"> & { showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <EBPRMark size={MARK_PX[size]} inverted={inverted} />
      {showText && (
        <Img src="/brand/ebpr-wordmark.png" alt="EB Public Relations" height={WORDMARK_H[size]} inverted={inverted} />
      )}
    </div>
  );
}
