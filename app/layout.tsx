import "./globals.css";

import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { Toaster } from "@/components/ui/sonner";
import { isSupportedLang, DEFAULT_LANG } from "@/lib/i18n-config";
import { SITE_URL, OG_IMAGE } from "@/lib/site";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "531Forever — 5/3/1 Forever Training Log",
    template: "%s | 531Forever",
  },
  description: "Personal training log for Jim Wendler's 5/3/1 Forever program. Track your Training Max, AMRAP results, strength progress and plan your entire macrocycle. No spreadsheets needed.",
  keywords: ["5/3/1", "531 Forever", "powerlifting", "strength training", "training log", "Jim Wendler", "Training Max", "AMRAP"],
  authors: [{ name: "531Forever" }],
  creator: "531Forever",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "531Forever",
    title: "531Forever - 5/3/1 Forever Training Log",
    description: "Personal training log for Jim Wendler's 5/3/1 Forever program. Track your Training Max, AMRAP results and strength progress. No spreadsheets needed.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "531Forever — Tréninkový deník pro 5/3/1 Forever",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "531Forever - 5/3/1 Forever Training Log",
    description: "Personal training log for Jim Wendler's 5/3/1 Forever program. Track your Training Max, AMRAP results and strength progress. No spreadsheets needed.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "531Forever",
  },
  formatDetection: {
    telephone: false,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get("lang")?.value;
  const lang = isSupportedLang(rawLang) ? rawLang : DEFAULT_LANG;

  return (
    <html lang={lang}>
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
          <I18nProvider lang={lang}>{children}</I18nProvider>
        </ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
