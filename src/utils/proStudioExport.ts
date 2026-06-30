import { trimVideoInBrowser } from "@/utils/videoProbe";
import { exportVideo, type ExportQuality } from "@/utils/videoTrimmer";
import { type WatermarkPosition } from "@/utils/watermarkCanvas";

import {
  buildStudioVideoFilter,
  type AspectMode,
  type CropMode,
  type VideoRotation,
} from "@/utils/studioFilters";
import {
  getLastFfmpegLog,
  loadFfmpegEngine,
  resetFfmpegLoader,
} from "@/utils/ffmpegLoader";

export type ExportPreset = "ultra_hd" | "discord" | "email" | "balanced";
export type ExportMode = "video" | "audio";

export type { AspectMode, CropMode, VideoRotation } from "@/utils/studioFilters";

export type StudioExportConfig = {
  segments: { start: number; end: number }[];
  aspectMode: AspectMode;
  cleanAudio: boolean;
  voiceBoost: boolean;
  speed: number;
  preset: ExportPreset;
  exportMode?: ExportMode;
  rotation?: VideoRotation;
  crop?: CropMode;
  flipH?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  watermark?: {
    pngBytes: Uint8Array;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
  };
  sticker?: {
    pngBytes: Uint8Array;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
  };
};

type ProgressCallback = (message: string, ratio?: number) => void;

function resetFfmpeg(): void {
  resetFfmpegLoader();
}

function exportError(err: unknown, fallback: string): Error {
  if (err instanceof Error) {
    const detail = getLastFfmpegLog()
      ? ` ${getLastFfmpegLog().slice(-180)}`
      : "";
    return new Error(
      err.message.includes("ffmpeg") || err.message.includes("failed")
        ? `${err.message}${detail}`
        : err.message,
    );
  }
  if (typeof err === "string" && err.trim()) return new Error(err);
  return new Error(fallback);
}

async function loadFfmpeg(onProgress?: ProgressCallback) {
  try {
    return await loadFfmpegEngine(onProgress);
  } catch (err) {
    resetFfmpegLoader();
    throw exportError(
      err,
      "Could not load video engine. Check your connection and try again.",
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function execChecked(
  ffmpeg: any,
  args: string[],
  step: string,
): Promise<void> {
  const code = await ffmpeg.exec(args);
  if (code !== 0) {
    const detail = getLastFfmpegLog()
      ? ` — ${getLastFfmpegLog().slice(-120)}`
      : "";
    throw new Error(`${step} failed${detail}`);
  }
}

function toBlob(data: Uint8Array, mime: string): Blob {
  return new Blob([new Uint8Array(data)], { type: mime });
}

function presetToQuality(preset: ExportPreset): ExportQuality {
  if (preset === "ultra_hd") return "high";
  if (preset === "discord") return "compact";
  return "balanced";
}

function codecArgs(preset: ExportPreset, attempt = 0): string[] {
  const crfBump = attempt * 5;
  switch (preset) {
    case "ultra_hd":
      return ["-c:v", "libvpx-vp9", "-crf", String(22 + crfBump), "-b:v", "4M"];
    case "discord":
      return ["-c:v", "libvpx-vp9", "-crf", String(36 + crfBump), "-b:v", "700k"];
    case "email":
      return ["-c:v", "libvpx-vp9", "-crf", String(32 + crfBump), "-b:v", "1.2M"];
    default:
      return ["-c:v", "libvpx-vp9", "-crf", String(28 + crfBump), "-b:v", "2M"];
  }
}

function scaleFilterForPreset(preset: ExportPreset): string | null {
  if (preset === "discord") return "scale='min(1280,iw)':-2";
  return null;
}

function audioFilterChain(clean: boolean, boost: boolean): string | null {
  if (!clean && !boost) return null;
  const filters: string[] = [];
  if (clean) filters.push("highpass=f=80", "lowpass=f=12000");
  if (boost) filters.push("volume=1.4");
  return filters.join(",");
}

function buildAtempoChain(speed: number): string {
  const filters: string[] = [];
  let remaining = speed;
  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 0.01) filters.push(`atempo=${remaining}`);
  return filters.join(",");
}

function hasVideoEffects(config: StudioExportConfig): boolean {
  return (
    config.aspectMode === "shorts" ||
    !!config.watermark ||
    !!config.sticker ||
    (config.rotation ?? 0) !== 0 ||
    (config.crop ?? "none") !== "none" ||
    !!config.flipH ||
    (config.fadeIn ?? 0) > 0 ||
    (config.fadeOut ?? 0) > 0
  );
}

async function cutClip(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  inputName: string,
  start: number,
  duration: number,
  outputName: string,
): Promise<void> {
  try {
    await execChecked(
      ffmpeg,
      [
        "-ss",
        String(start),
        "-i",
        inputName,
        "-t",
        String(duration),
        "-c",
        "copy",
        outputName,
      ],
      "Cut clip",
    );
  } catch {
    await execChecked(
      ffmpeg,
      [
        "-ss",
        String(start),
        "-i",
        inputName,
        "-t",
        String(duration),
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "2M",
        "-c:a",
        "libopus",
        "-b:a",
        "128k",
        outputName,
      ],
      "Re-encode clip",
    );
  }
}

async function concatSegments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  segments: { start: number; end: number }[],
  inputName: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  if (segments.length === 1) {
    const s = segments[0];
    onProgress?.("Cutting segment…", 20);
    await cutClip(ffmpeg, inputName, s.start, s.end - s.start, "merged.webm");
    return "merged.webm";
  }

  const clipNames: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const name = `clip${i}.webm`;
    onProgress?.(`Extracting clip ${i + 1}/${segments.length}…`, 15 + i * 5);
    await cutClip(ffmpeg, inputName, s.start, s.end - s.start, name);
    clipNames.push(name);
  }

  const list = clipNames.map((n) => `file '${n}'`).join("\n");
  await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(list));
  onProgress?.("Merging segments…", 45);

  try {
    await execChecked(
      ffmpeg,
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        "-c",
        "copy",
        "merged.webm",
      ],
      "Merge clips",
    );
  } catch {
    await execChecked(
      ffmpeg,
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "2M",
        "-c:a",
        "libopus",
        "-b:a",
        "128k",
        "merged.webm",
      ],
      "Re-encode merge",
    );
  }

  for (const n of clipNames) await ffmpeg.deleteFile(n).catch(() => undefined);
  await ffmpeg.deleteFile("concat.txt").catch(() => undefined);
  return "merged.webm";
}

async function encodeMerged(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  config: StudioExportConfig,
  mergedName: string,
  totalDuration: number,
  attempt: number,
  onProgress?: ProgressCallback,
): Promise<Uint8Array> {
  const outputName =
    config.exportMode === "audio" ? "final-audio.webm" : "final.webm";
  const speed = config.speed;
  const hasSpeed = speed !== 1;

  if (config.exportMode === "audio") {
    const args: string[] = ["-i", mergedName, "-vn"];
    const audioChain = audioFilterChain(config.cleanAudio, config.voiceBoost);
    if (hasSpeed) {
      const tempo = buildAtempoChain(speed);
      const merged = [audioChain, tempo].filter(Boolean).join(",");
      if (merged) args.push("-af", merged);
    } else if (audioChain) {
      args.push("-af", audioChain);
    }
    args.push("-c:a", "libopus", "-b:a", "192k", outputName);
    onProgress?.("Extracting audio…", 60);
    await execChecked(ffmpeg, args, "Audio extract");
    return (await ffmpeg.readFile(outputName)) as Uint8Array;
  }

  const wm = config.watermark;
  const sticker = config.sticker;
  const videoFilter = buildStudioVideoFilter({
    aspectMode: config.aspectMode,
    rotation: config.rotation ?? 0,
    crop: config.crop ?? "none",
    flipH: !!config.flipH,
    fadeIn: config.fadeIn ?? 0,
    fadeOut: config.fadeOut ?? 0,
    totalDuration,
    watermark: wm
      ? { opacity: wm.opacity, scale: wm.scale, position: wm.position }
      : undefined,
    sticker: sticker
      ? {
          opacity: sticker.opacity,
          scale: sticker.scale,
          position: sticker.position,
        }
      : undefined,
    watermarkInput: wm ? "1:v" : undefined,
    stickerInput: sticker ? (wm ? "2:v" : "1:v") : undefined,
  });
  const scaleOnly = !videoFilter ? scaleFilterForPreset(config.preset) : null;

  const args: string[] = ["-i", mergedName];
  if (wm) args.push("-i", "logo.png");
  if (sticker) args.push("-i", "sticker.png");

  if (videoFilter) {
    let chain = videoFilter;
    if (hasSpeed) {
      chain = `${chain.replace("[outv]", "[vspd]")};[vspd]setpts=PTS/${speed}[outv]`;
    }
    if (scaleOnly) {
      chain = `${chain.replace("[outv]", "[vsc]")};[vsc]${scaleOnly}[outv]`;
    }
    args.push("-filter_complex", chain);
    args.push("-map", "[outv]");
    args.push("-map", "0:a?");
  } else if (hasSpeed || scaleOnly) {
    const vf: string[] = [];
    if (scaleOnly) vf.push(scaleOnly);
    if (hasSpeed) vf.push(`setpts=PTS/${speed}`);
    args.push("-vf", vf.join(","));
    args.push("-map", "0:v");
    args.push("-map", "0:a?");
  } else {
    args.push("-map", "0:v");
    args.push("-map", "0:a?");
  }

  const audioChain = audioFilterChain(config.cleanAudio, config.voiceBoost);
  if (hasSpeed) {
    const tempo = buildAtempoChain(speed);
    const merged = [audioChain, tempo].filter(Boolean).join(",");
    if (merged) args.push("-af", merged);
  } else if (audioChain) {
    args.push("-af", audioChain);
  }

  args.push(...codecArgs(config.preset, attempt));
  args.push("-c:a", "libopus", "-b:a", "128k", outputName);

  onProgress?.("Encoding export…", 60 + attempt * 8);
  await execChecked(ffmpeg, args, "Encode");
  return (await ffmpeg.readFile(outputName)) as Uint8Array;
}

function segmentDuration(segments: { start: number; end: number }[]): number {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

async function runFfmpegPipeline(
  blob: Blob,
  config: StudioExportConfig,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const segments = config.segments.filter((s) => s.end > s.start);
  const { ffmpeg, fetchFile } = await loadFfmpeg(onProgress);
  const inputName = "input.webm";
  const isAudio = config.exportMode === "audio";
  const mime = isAudio ? "audio/webm" : "video/webm";
  const totalDuration = segmentDuration(segments) / config.speed;

  await ffmpeg.writeFile(inputName, await fetchFile(blob));
  const mergedName = await concatSegments(ffmpeg, segments, inputName, onProgress);

  if (config.watermark) {
    await ffmpeg.writeFile("logo.png", config.watermark.pngBytes);
  }
  if (config.sticker) {
    await ffmpeg.writeFile("sticker.png", config.sticker.pngBytes);
  }

  let data: Uint8Array;
  try {
    data = await encodeMerged(
      ffmpeg,
      config,
      mergedName,
      totalDuration,
      0,
      onProgress,
    );
  } catch {
    data = await encodeMerged(
      ffmpeg,
      config,
      mergedName,
      totalDuration,
      1,
      onProgress,
    );
  }

  let result = toBlob(data, mime);

  if (!isAudio) {
    const maxBytes =
      config.preset === "discord"
        ? 8 * 1024 * 1024
        : config.preset === "email"
          ? 25 * 1024 * 1024
          : Infinity;

    let attempt = 2;
    while (result.size > maxBytes && attempt < 5) {
      onProgress?.(`Compressing for ${config.preset}…`, 70 + attempt * 4);
      data = await encodeMerged(
        ffmpeg,
        config,
        mergedName,
        totalDuration,
        attempt,
        onProgress,
      );
      result = toBlob(data, mime);
      attempt += 1;
    }
  }

  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile(mergedName).catch(() => undefined);
  if (config.watermark) await ffmpeg.deleteFile("logo.png").catch(() => undefined);
  if (config.sticker) await ffmpeg.deleteFile("sticker.png").catch(() => undefined);

  onProgress?.("Done", 100);
  return result;
}

export async function renderStudioExport(
  blob: Blob,
  config: StudioExportConfig,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const segments = config.segments.filter((s) => s.end > s.start);
  if (segments.length === 0) throw new Error("No segments to export.");

  const needsAdvancedPipeline =
    config.exportMode === "audio" ||
    hasVideoEffects(config) ||
    config.cleanAudio ||
    config.voiceBoost ||
    config.speed !== 1 ||
    config.preset === "discord" ||
    config.preset === "email" ||
    segments.length > 1;

  if (!needsAdvancedPipeline) {
    const s = segments[0];
    onProgress?.("Exporting clip…", 10);
    try {
      return await exportVideo(
        blob,
        {
          startSec: s.start,
          endSec: s.end,
          quality: presetToQuality(config.preset),
        },
        onProgress,
      );
    } catch (err) {
      onProgress?.("Trying browser export…", 15);
      try {
        return await trimVideoInBrowser(blob, s.start, s.end, onProgress);
      } catch {
        throw exportError(
          err,
          "Export failed. Try a shorter clip or download the raw WebM.",
        );
      }
    }
  }

  try {
    return await runFfmpegPipeline(blob, config, onProgress);
  } catch (err) {
    if (
      segments.length === 1 &&
      config.aspectMode === "landscape" &&
      !hasVideoEffects(config) &&
      config.exportMode !== "audio"
    ) {
      const s = segments[0];
      onProgress?.("Advanced export failed — trying simple trim…", 12);
      try {
        return await exportVideo(
          blob,
          {
            startSec: s.start,
            endSec: s.end,
            speed: config.speed,
            quality: presetToQuality(config.preset),
          },
          onProgress,
        );
      } catch (inner) {
        try {
          return await trimVideoInBrowser(blob, s.start, s.end, onProgress);
        } catch {
          throw exportError(
            inner,
            "Export failed. Disable Shorts/audio filters or download raw WebM.",
          );
        }
      }
    }
    resetFfmpeg();
    throw exportError(
      err,
      "Export failed. Try Balanced preset without Shorts or audio filters.",
    );
  }
}

export const EXPORT_PRESETS: {
  id: ExportPreset;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    id: "ultra_hd",
    label: "Ultra HD",
    hint: "Best quality · 1440p preserved",
    icon: "🚀",
  },
  {
    id: "discord",
    label: "Discord / Slack",
    hint: "Under 8 MB · auto-compressed",
    icon: "💬",
  },
  {
    id: "email",
    label: "Email Safe",
    hint: "Under 25 MB · share anywhere",
    icon: "📧",
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Quality + size sweet spot",
    icon: "⚖️",
  },
];
