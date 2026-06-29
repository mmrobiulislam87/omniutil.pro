import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2563eb, #4f46e5)",
          borderRadius: "32px",
          fontSize: "80px",
        }}
      >
        ⚡
      </div>
    ),
    { ...size },
  );
}
