import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Sans_Arabic } from "next/font/google";
import Link from "next/link";
import { SerwistProvider } from "@serwist/next/react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { OfflineBanner } from "@/components/OfflineBanner";
import { dirOf, type Locale } from "@/i18n/config";
import { getUser } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin", "latin-ext"], weight: ["600", "700"], variable: "--font-barlow-condensed", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-ar", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Coach Me", template: "%s · Coach Me" },
  description: "Football session planner for coaches: timed sessions, animated practices, a personal library and shareable links.",
  applicationName: "Coach Me",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Coach Me", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const user = await getUser();
  const t = await getTranslations("common");
  const legal = await getTranslations("legal");
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${barlow.variable} ${barlowCondensed.variable} ${plexArabic.variable}`}>
      <body>
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#content" className="sr-only-x focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:bg-surface focus:p-3">
            {t("skipToContent")}
          </a>
          <Header user={user} emailSignIn={getConfig().backend !== "mongo"} />
          <OfflineBanner />
          <main id="content" className="wrap py-6 sm:py-8">
            {children}
          </main>
          <footer className="wrap flex flex-wrap gap-x-6 gap-y-2 border-t border-line py-6 text-sm muted">
            <span className="inline-flex min-h-11 items-center">{t("brand")}</span>
            <Link href="/privacy" className="inline-flex min-h-11 items-center">{legal("privacyTitle")}</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center">{legal("termsTitle")}</Link>
          </footer>
        </NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
