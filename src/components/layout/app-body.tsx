
"use client";

import { useSettings } from "@/context/settings-context";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// This component must be a client component to use the useSettings hook.
export function AppBody({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  // Determine the theme class.
  const themeClass = settings?.appearance?.theme;

  return (
    <body className={`font-sans antialiased ${inter.variable} ${themeClass}`}>
      {children}
      <Toaster />
    </body>
  );
}
