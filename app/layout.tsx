import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast-provider";
import "@/src/styles/design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azzure AutoQuote",
  description: "AI-assisted jewelry quote estimation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
