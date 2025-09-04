
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/context/currency-context";
import { AuthProvider } from "@/context/auth-context";
import { SettingsProvider } from "@/context/settings-context";
import { Inter } from "next/font/google";
import { AppBody } from "@/components/layout/app-body";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// This is a server component, so it can export metadata.
export const metadata: Metadata = {
  title: "Adhunik Invoicer",
  description: "Inventory Management & Billing System for Adhunik Marbles",
};

// This is the root layout, a server component that sets up providers.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <AuthProvider>
        <SettingsProvider>
          <CurrencyProvider>
            {/* AppBody is a client component that will render the body tag and children */}
            <AppBody>
              {children}
            </AppBody>
          </CurrencyProvider>
        </SettingsProvider>
      </AuthProvider>
    </html>
  );
}
