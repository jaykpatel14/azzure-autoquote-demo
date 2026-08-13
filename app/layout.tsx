import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast-provider";
import "@/src/styles/design-tokens.css";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "600"],
  variable: "--font-cormorant"
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-face"
});

export const metadata: Metadata = {
  title: "Azzure AutoQuote",
  description: "AI-assisted jewelry quote estimation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${cormorantGaramond.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
