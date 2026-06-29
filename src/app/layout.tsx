import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import LayoutShell from "@/components/LayoutShell";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig, absoluteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | Privacy-First Global Utility Tools`,
    template: "%s | OmniUtil.pro",
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: "OmniUtil Team" }],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: `${siteConfig.name} | Privacy-First Global Utility Tools`,
    description:
      "100% Client-Side Processing. No File Uploads. Secure, fast, and serverless tools for global professionals.",
    siteName: siteConfig.name,
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | 100% Secure Client-Side Tools`,
    description:
      "Process images, CSV data, and AI prompts locally. Zero logs, zero tracking, zero server latency.",
    images: [absoluteUrl("/opengraph-image")],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "1LWDxgIW5OPV7s1YunFLRuCWURMvvFSq0R4fDg51C3g",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen bg-[#0B0F19] font-sans text-gray-100 antialiased">
        <JsonLd />
        <AppProvider>
          <LayoutShell>{children}</LayoutShell>
        </AppProvider>
      </body>
    </html>
  );
}
