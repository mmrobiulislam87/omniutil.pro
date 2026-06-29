import { siteConfig, absoluteUrl } from "@/lib/site";

export function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Client-side image compression (WebP, AVIF, JPEG, PNG)",
      "AI prompt engineering (CO-STAR, RISEN)",
      "CSV data cleaning and validation",
      "Zero server uploads",
      "100% privacy-first processing",
    ],
    screenshot: absoluteUrl("/opengraph-image"),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
