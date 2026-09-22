import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // EBPR Brand — black/white monochromatic system
        brand: {
          black: "#0A0A0A",
          white: "#FFFFFF",
        },
        // Accent (single brand accent; swap this one value to re-theme)
        accent2: {
          DEFAULT: "#FF5A36",
          soft: "#FFF1EC",
          ink: "#B93A1F",
        },
        // Surface hierarchy
        surface: {
          1: "#FAFAF9", // page background
          2: "#F4F4F2", // card/panel background
          3: "#EEECEA", // subtle input bg
        },
        // Text hierarchy
        ink: {
          primary: "#0A0A0A",
          secondary: "#5A5A58",
          muted: "#9A9A98",
          inverted: "#FFFFFF",
        },
        // Borders
        border: {
          DEFAULT: "#E4E4E1",
          strong: "#C8C8C5",
        },
        // Status colors (minimal, desaturated to match brand)
        status: {
          idea: { bg: "#F4F4F2", text: "#5A5A58" },
          outreach: { bg: "#EEF2FF", text: "#3730A3" },
          confirmed: { bg: "#FFF7ED", text: "#9A3412" },
          completed: { bg: "#F0FDF4", text: "#166534" },
          cancelled: { bg: "#FEF2F2", text: "#991B1B" },
        },
        // Semantic aliases (used by shadcn)
        background: "#FAFAF9",
        foreground: "#0A0A0A",
        card: { DEFAULT: "#FFFFFF", foreground: "#0A0A0A" },
        popover: { DEFAULT: "#FFFFFF", foreground: "#0A0A0A" },
        primary: { DEFAULT: "#0A0A0A", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#F4F4F2", foreground: "#0A0A0A" },
        muted: { DEFAULT: "#F4F4F2", foreground: "#5A5A58" },
        accent: { DEFAULT: "#F4F4F2", foreground: "#0A0A0A" },
        destructive: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        input: "#E4E4E1",
        ring: "#0A0A0A",
      },
      borderRadius: {
        "2xl": "1rem",
        xl: "0.75rem",
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,10,10,0.04), 0 1px 3px rgba(10,10,10,0.06)",
        "card-hover": "0 2px 6px rgba(10,10,10,0.06), 0 8px 24px rgba(10,10,10,0.08)",
        pop: "0 8px 28px rgba(10,10,10,0.14), 0 2px 8px rgba(10,10,10,0.06)",
        inset: "inset 0 1px 2px rgba(10,10,10,0.04)",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        display: ["2.25rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-lg": ["3rem", { lineHeight: "1", letterSpacing: "-0.035em", fontWeight: "600" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(0.97)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.18s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "slide-in-left": "slide-in-left 0.2s ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
