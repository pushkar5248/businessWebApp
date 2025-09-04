
"use client";

import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/context/currency-context";
import { AuthProvider } from "@/context/auth-context";
import { SettingsProvider, useSettings } from "@/context/settings-context";
import { Inter } from "next/font/google";
import "./globals.css";


const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Metadata can't be in a client component, so we export it from the server component wrapper.
export const metadata: Metadata = {
  title: "Adhunik Invoicer",
  description: "Inventory Management & Billing System for Adhunik Marbles",
};

function AppBody({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const themeClass = settings?.appearance?.theme === 'light' || settings?.appearance?.theme === 'dark' 
    ? settings.appearance.theme 
    : `dark theme-${settings?.appearance?.theme}`;

  return (
    <body className={`font-sans antialiased ${inter.variable} ${themeClass}`}>
      {children}
    </body>
  );
}


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
            <AppBody>
              {children}
              <Toaster />
            </AppBody>
          </CurrencyProvider>
        </SettingsProvider>
      </AuthProvider>
    </html>
  );
}
