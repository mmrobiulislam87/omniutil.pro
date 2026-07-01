import { overlayCoords, type WatermarkPosition } from "@/utils/watermarkCanvas";

export type AspectMode = "landscape" | "shorts";

export type VideoRotation = 0 | 90 | 180 | 270;
export type CropMode = "none" | "tight" | "square" | "cinema";

export type ImageOverlaySpec = {
  opacity: number;
  scale: number;
  position: WatermarkPosition;
};

/** Cap width before heavy filters — keeps ffmpeg.wasm inside WASM memory limits. */
function wasmSafeDownscale(vin: string, vout: string): string {
  return `[${vin}]scale='min(1920,iw)':-2:flags=bilinear[${vout}]`;
}

/** 9:16 Shorts — low-res upscale bg (no gblur; split required when fan-out). */
function shortsBase(vin: string, vout: string, lite: boolean): string {
  if (lite) {
    return `[${vin}]scale=1080:-2:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0f[${vout}]`;
  }
  return [
    `[${vin}]split=2[sb1][sb2]`,
    `[sb1]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,scale=1080:1920:flags=bilinear[bg]`,
    `[sb2]scale=1080:-2:force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[${vout}]`,
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
  if (crop === "tight") {
    f.push("crop=iw*0.85:ih*0.85:(iw-ow)/2:(ih-oh)/2");
  } else if (crop === "square") {
    f.push("crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))/2':'(ih-min(iw,ih))/2'");
  } else if (crop === "cinema") {
    f.push("crop=iw:iw*9/16:(iw-ow)/2:(ih-oh)/2");
  }
  if (flipH) f.push("hflip");
  return f;
}

function fadeFilters(fadeIn: number, fadeOut: number, duration: number): string[] {
  const safeDuration = Math.max(0.1, duration);
  const f: string[] = [];
  if (fadeIn > 0) f.push(`fade=t=in:st=0:d=${Math.min(fadeIn, safeDuration)}`);
  if (fadeOut > 0 && safeDuration > fadeOut) {
    f.push(
      `fade=t=out:st=${Math.max(0, safeDuration - fadeOut)}:d=${fadeOut}`,
    );
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
  /** Safer filter graph for ffmpeg.wasm (pad shorts, skip fades). */
  lite?: boolean;
}): string | null {
  const lite = !!opts.lite;
  const parts: string[] = [];
  const tf = transformFilters(opts.rotation, opts.crop, opts.flipH);
  const ff = lite ? [] : fadeFilters(opts.fadeIn, opts.fadeOut, opts.totalDuration);

  const needsGraph =
    tf.length > 0 ||
    opts.aspectMode === "shorts" ||
    ff.length > 0 ||
    !!opts.watermark ||
    !!opts.sticker;

  if (!needsGraph) return null;

  let current = "0:v";
  let stage = 0;
  const next = () => {
    stage += 1;
    return `v${stage}`;
  };

  const down = next();
  parts.push(wasmSafeDownscale(current, down));
  current = down;

  if (tf.length > 0) {
    const out = next();
    parts.push(`[${current}]${tf.join(",")}[${out}]`);
    current = out;
  }

  if (opts.aspectMode === "shorts") {
    const out = next();
    parts.push(shortsBase(current, out, lite));
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
    parts.push(`[${current}]format=yuv420p[outv]`);
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
