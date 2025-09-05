
import type { Metadata } from "next";
import { AuthProvider } from "@/context/auth-context";
import { CurrencyProvider } from "@/context/currency-context";
import { SettingsProvider } from "@/context/settings-context";
import { DataSyncProvider } from "@/context/data-sync-context";
import { AppBody } from "@/components/layout/app-body";
import "./globals.css";

// This is a server component, so it can export metadata.
export const metadata: Metadata = {
  title: "Adhunik Minerals",
  description: "Inventory Management & Billing System for Adhunik Minerals",
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
          <DataSyncProvider>
            <CurrencyProvider>
              {/* AppBody is a client component that will render the body tag and children */}
              <AppBody>{children}</AppBody>
            </CurrencyProvider>
          </DataSyncProvider>
        </SettingsProvider>
      </AuthProvider>
    </html>
  );
}
