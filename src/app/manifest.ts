import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — Privacy First Tools`,
    short_name: siteConfig.shortName,
    description: "Zero-server-cost utility platform for professionals.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F19",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
