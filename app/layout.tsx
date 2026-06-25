import "./globals.css";

import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { Toaster } from "@/components/ui/sonner";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-barlow-condensed",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Silový deník",
  description: "Osobní deník silového tréninku",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Silový deník",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <head>
        <meta name="theme-color" content="#ff4500" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className={`${barlowCondensed.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ConvexClientProvider>
          <I18nProvider>{children}</I18nProvider>
        </ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
