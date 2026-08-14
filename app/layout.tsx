import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast-provider";
import "@/src/styles/design-tokens.css";
import "./globals.css";

const displayFont = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display-loaded", display: "swap" });
const uiFont = Inter({ subsets: ["latin"], variable: "--font-ui-loaded", display: "swap" });
const monoFont = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", display: "swap" });

export const metadata: Metadata = {
  title: "Azzure AutoQuote",
  description: "AI-assisted jewelry quote estimation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
