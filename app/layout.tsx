import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast-provider";
import "@/src/styles/design-tokens.css";
import "./globals.css";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
  weight: ["400", "600", "700"]
});
const uiFont = Inter({ subsets: ["latin"], variable: "--font-ui-loaded", display: "swap" });
const monoFont = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", display: "swap" });

export const metadata: Metadata = {
  title: "Azzure AI Quote | AI Pricing for Luxury Jewelry Retailers",
  description:
    "The ultimate AI-powered pricing engine for luxury jewelry retailers. Close bespoke commissions instantly on the showroom floor with real-time, mathematically perfect quotes."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className={`${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
