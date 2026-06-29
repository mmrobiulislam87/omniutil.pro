import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0B0F19 0%, #111827 50%, #1e1b4b 100%)",
          color: "#f3f4f6",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #60a5fa, #818cf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            ⚡
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 800,
              background: "linear-gradient(90deg, #60a5fa, #818cf8)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            OmniUtil.pro
          </span>
        </div>
        <p style={{ fontSize: "36px", fontWeight: 700, margin: "0 0 16px" }}>
          {siteConfig.tagline}
        </p>
        <p style={{ fontSize: "24px", color: "#9ca3af", margin: 0, maxWidth: "800px" }}>
          100% client-side processing. No uploads. No tracking.
        </p>
      </div>
    ),
    { ...size },
  );
}
