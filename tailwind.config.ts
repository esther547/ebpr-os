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
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
