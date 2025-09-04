
"use client";

import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/context/currency-context";
import { AuthProvider } from "@/context/auth-context";
import { SettingsProvider, useSettings } from "@/context/settings-context";
import { Inter } from "next/font/google";
import "./globals.css";


const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// This component must be a client component to use the useSettings hook.
function AppBody({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  // Determine the theme class. The new themes are prefixed with "theme-".
  const themeClass = settings?.appearance?.theme === 'light' || settings?.appearance?.theme === 'dark' 
    ? settings.appearance.theme 
    : `dark theme-${settings?.appearance?.theme}`;

  return (
    <body className={`font-sans antialiased ${inter.variable} ${themeClass}`}>
      {children}
    </body>
  );
}

// We wrap the layout in a new component that is NOT a client component, so it can export metadata.
function AppLayout({
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

export const metadata: Metadata = {
  title: "Adhunik Invoicer",
  description: "Inventory Management & Billing System for Adhunik Marbles",
};

export default AppLayout;
