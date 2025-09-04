
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
      <Toaster />
    </body>
  );
}

// We need to wrap the layout in a component that is NOT a client component, so it can export metadata.
// However, the providers themselves rely on client-side state. So we create a structure where the top-level
// layout is a server component, but it renders client-side providers which in turn render a client component for the body.
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
