"use client";

import { cn } from "@/lib/utils";

type EBPRLogoProps = {
  variant?: "mark" | "full" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  inverted?: boolean;
};

const sizes = {
  sm: { mark: 28, wordmark: "text-xs tracking-widest" },
  md: { mark: 40, wordmark: "text-sm tracking-widest" },
  lg: { mark: 56, wordmark: "text-base tracking-widest" },
  xl: { mark: 80, wordmark: "text-lg tracking-widest" },
};

// The EBPR geometric mark: 4 circles in 2×2 grid divided by a vertical line
// with alternating filled/outlined quadrants
function EBPRMark({
  size = 40,
  color = "#0A0A0A",
}: {
  size?: number;
  color?: string;
}) {
  const s = size;
  const r = s * 0.22; // circle radius
  const cx1 = s * 0.31; // left column center x
  const cx2 = s * 0.69; // right column center x
  const cy1 = s * 0.31; // top row center y
  const cy2 = s * 0.69; // bottom row center y
  const strokeW = s * 0.055;
  const lineX = s * 0.5;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="EB Public Relations logo mark"
    >
      {/* ── Top-left: circle outline only ── */}
      <circle
        cx={cx1}
        cy={cy1}
        r={r}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
      />

      {/* ── Top-right: top half outline, bottom half filled ── */}
      {/* Full circle stroke */}
      <circle
        cx={cx2}
        cy={cy1}
        r={r}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
      />
      {/* Bottom filled half (clip to bottom) */}
      <clipPath id="top-right-bottom">
        <rect x={cx2 - r} y={cy1} width={r * 2} height={r + strokeW} />
      </clipPath>
      <circle cx={cx2} cy={cy1} r={r} fill={color} clipPath="url(#top-right-bottom)" />

      {/* ── Bottom-left: top half filled, bottom outline ── */}
      <circle
        cx={cx1}
        cy={cy2}
        r={r}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
      />
      <clipPath id="bottom-left-top">
        <rect x={cx1 - r} y={cy2 - r - strokeW} width={r * 2} height={r + strokeW} />
      </clipPath>
      <circle cx={cx1} cy={cy2} r={r} fill={color} clipPath="url(#bottom-left-top)" />

      {/* ── Bottom-right: circle outline only ── */}
      <circle
        cx={cx2}
        cy={cy2}
        r={r}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
      />

      {/* ── Center vertical divider line ── */}
      <line
        x1={lineX}
        y1={s * 0.06}
        x2={lineX}
        y2={s * 0.94}
        stroke={color}
        strokeWidth={strokeW * 0.9}
        strokeLinecap="square"
      />
    </svg>
  );
}

export function EBPRLogo({
  variant = "full",
  size = "md",
  className,
  inverted = false,
}: EBPRLogoProps) {
  const color = inverted ? "#FFFFFF" : "#0A0A0A";
  const markSize = sizes[size].mark;
  const wordmarkClass = sizes[size].wordmark;

  if (variant === "mark") {
    return (
      <div className={cn("flex items-center", className)}>
        <EBPRMark size={markSize} color={color} />
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <div className={className}>
        <span
          className={cn(
            "font-bold uppercase",
            wordmarkClass,
            inverted ? "text-white" : "text-ink-primary"
          )}
        >
          EB Public Relations
        </span>
      </div>
    );
  }

  // full: mark + wordmark stacked
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <EBPRMark size={markSize} color={color} />
      <span
        className={cn(
          "font-bold uppercase",
          wordmarkClass,
          inverted ? "text-white" : "text-ink-primary"
        )}
      >
        EB Public Relations
      </span>
    </div>
  );
}

// Horizontal variant (mark + text side by side) — used in sidebar
export function EBPRLogoHorizontal({
  size = "md",
  className,
  inverted = false,
  showText = true,
}: Omit<EBPRLogoProps, "variant"> & { showText?: boolean }) {
  const color = inverted ? "#FFFFFF" : "#0A0A0A";
  const markSize = sizes[size].mark;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <EBPRMark size={markSize} color={color} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-bold uppercase tracking-[0.15em] text-[11px]",
              inverted ? "text-white" : "text-ink-primary"
            )}
          >
            EB Public
          </span>
          <span
            className={cn(
              "font-bold uppercase tracking-[0.15em] text-[11px]",
              inverted ? "text-white" : "text-ink-primary"
            )}
          >
            Relations
          </span>
        </div>
      )}
    </div>
  );
}
