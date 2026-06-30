import { overlayCoords, type WatermarkPosition } from "@/utils/watermarkCanvas";

export type AspectMode = "landscape" | "shorts";

export type VideoRotation = 0 | 90 | 180 | 270;
export type CropMode = "none" | "tight" | "square" | "cinema";

export type ImageOverlaySpec = {
  opacity: number;
  scale: number;
  position: WatermarkPosition;
};

function shortsBase(vin: string, vout: string): string {
  return [
    `[${vin}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=18[bg]`,
    `[${vin}]scale=1080:-2:force_original_aspect_ratio=decrease[cropv]`,
    `[bg][cropv]overlay=(W-w)/2:(H-h)/2[${vout}]`,
  ].join(";");
}

function transformFilters(
  rotation: VideoRotation,
  crop: CropMode,
  flipH: boolean,
): string[] {
  const f: string[] = [];
  if (rotation === 90) f.push("transpose=1");
  else if (rotation === 180) f.push("transpose=1,transpose=1");
  else if (rotation === 270) f.push("transpose=2");
  if (crop === "tight") f.push("crop=iw*0.85:ih*0.85");
  else if (crop === "square") f.push("crop='min(iw,ih)':'min(iw,ih)'");
  else if (crop === "cinema") f.push("crop=iw:iw*9/16");
  if (flipH) f.push("hflip");
  return f;
}

function fadeFilters(fadeIn: number, fadeOut: number, duration: number): string[] {
  const f: string[] = [];
  if (fadeIn > 0) f.push(`fade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0 && duration > fadeOut) {
    f.push(`fade=t=out:st=${Math.max(0, duration - fadeOut)}:d=${fadeOut}`);
  }
  return f;
}

export function buildStudioVideoFilter(opts: {
  aspectMode: AspectMode;
  rotation: VideoRotation;
  crop: CropMode;
  flipH: boolean;
  fadeIn: number;
  fadeOut: number;
  totalDuration: number;
  watermark?: ImageOverlaySpec;
  sticker?: ImageOverlaySpec;
  watermarkInput?: string;
  stickerInput?: string;
}): string | null {
  const parts: string[] = [];
  const tf = transformFilters(opts.rotation, opts.crop, opts.flipH);
  const ff = fadeFilters(opts.fadeIn, opts.fadeOut, opts.totalDuration);

  let current = "0:v";
  let stage = 0;
  const next = () => {
    stage += 1;
    return `v${stage}`;
  };

  if (tf.length > 0) {
    const out = next();
    parts.push(`[${current}]${tf.join(",")}[${out}]`);
    current = out;
  }

  if (opts.aspectMode === "shorts") {
    const out = next();
    parts.push(shortsBase(current, out));
    current = out;
  }

  if (ff.length > 0) {
    const out = next();
    parts.push(`[${current}]${ff.join(",")}[${out}]`);
    current = out;
  }

  const wmIn = opts.watermarkInput ?? "1:v";
  const stIn = opts.stickerInput ?? (opts.watermark ? "2:v" : "1:v");

  if (opts.watermark) {
    const out = next();
    const pos = overlayCoords(opts.watermark.position);
    parts.push(
      `[${wmIn}]format=rgba,colorchannelmixer=aa=${opts.watermark.opacity},scale=iw*${opts.watermark.scale}:-1[wm];[${current}][wm]overlay=${pos}[${out}]`,
    );
    current = out;
  }

  if (opts.sticker) {
    const out = "outv";
    const pos = overlayCoords(opts.sticker.position);
    parts.push(
      `[${stIn}]format=rgba,colorchannelmixer=aa=${opts.sticker.opacity},scale=iw*${opts.sticker.scale}:-1[st];[${current}][st]overlay=${pos}[${out}]`,
    );
    current = out;
  } else {
    parts.push(`[${current}]null[outv]`);
  }

  return parts.length > 0 ? parts.join(";") : null;
}

export function getPreviewTransformStyle(
  rotation: VideoRotation,
  crop: CropMode,
  flipH: boolean,
): { transform: string } {
  const scale =
    crop === "tight" ? 1.12 : crop === "square" || crop === "cinema" ? 1.08 : 1;
  return {
    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scale(${scale})`,
  };
}
