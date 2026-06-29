export const siteConfig = {
  name: "OmniUtil.pro",
  shortName: "OmniUtil",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://omniutil.pro",
  description:
    "Free, ultra-fast, and 100% secure client-side tools. Your files and data never leave your device. Process images, data, and AI prompts instantly.",
  tagline: "Smart Utilities. Zero Server Costs.",
  keywords: [
    "client-side tools",
    "privacy tools",
    "image compressor",
    "WASM image optimizer",
    "WebP to AVIF converter",
    "CSV cleaner",
    "secure CSV cleaner",
    "AI prompt generator",
    "no-server utilities",
    "batch image compressor",
  ],
} as const;

export function absoluteUrl(path = ""): string {
  return `${siteConfig.url}${path}`;
}
