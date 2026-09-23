import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EBPR OS",
    template: "%s — EBPR OS",
  },
  description: "EB Public Relations — Internal Operating System",
  icons: { icon: "/brand/ebpr-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body className="min-h-screen font-sans">
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
