export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export async function renderTextWatermarkPng(
  text: string,
  opacity: number,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const fontSize = 28;
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + 24;
  canvas.height = fontSize + 20;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = Math.max(0.1, Math.min(1, opacity));
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(text, 12, fontSize + 4);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function overlayCoords(
  position: WatermarkPosition,
  margin = 24,
): string {
  switch (position) {
    case "top-left":
      return `${margin}:${margin}`;
    case "top-right":
      return `main_w-overlay_w-${margin}:${margin}`;
    case "bottom-left":
      return `${margin}:main_h-overlay_h-${margin}`;
    default:
      return `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`;
  }
}
