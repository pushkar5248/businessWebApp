import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { CurrencyProvider } from "@/context/currency-context";
import { AuthProvider } from "@/context/auth-context";
import { SettingsProvider } from "@/context/settings-context";
import { Inter } from "next/font/google";
import "./globals.css";


const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Adhunik Invoicer",
  description: "Inventory Management & Billing System for Adhunik Marbles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased ${inter.variable}`}>
        <AuthProvider>
          <SettingsProvider>
            <CurrencyProvider>
                {children}
            </CurrencyProvider>
          </SettingsProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
