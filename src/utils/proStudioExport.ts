import { trimVideoInBrowser } from "@/utils/videoProbe";
import { exportVideo, type ExportQuality } from "@/utils/videoTrimmer";
import { type WatermarkPosition } from "@/utils/watermarkCanvas";

import {
  buildStudioVideoFilter,
  effectFilterTiers,
  type AspectMode,
  type CropMode,
  type FilterTier,
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
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
  };
  audioSegments?: { start: number; end: number }[];
};

type ProgressCallback = (message: string, ratio?: number) => void;

function resetFfmpeg(): void {
  resetFfmpegLoader();
}

function exportError(err: unknown, fallback: string): Error {
  if (isWasmMemoryError(err)) {
    return new Error(
      "Video processing ran out of memory. Effects will retry in browser mode automatically.",
    );
  }
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

function codecArgs(
  preset: ExportPreset,
  attempt = 0,
  useVp8 = false,
): string[] {
  const crfBump = attempt * 5;
  if (useVp8) {
    const crf =
      preset === "discord" ? 20 + crfBump : preset === "ultra_hd" ? 8 + crfBump : 12 + crfBump;
    const bv =
      preset === "discord" ? "900k" : preset === "ultra_hd" ? "2.5M" : "1.5M";
    return [
      "-c:v",
      "libvpx",
      "-crf",
      String(crf),
      "-b:v",
      bv,
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
      "-threads",
      "1",
    ];
  }
  const wasmVp9 = [
    "-deadline",
    "realtime",
    "-cpu-used",
    "8",
    "-threads",
    "1",
    "-row-mt",
    "0",
  ];
  switch (preset) {
    case "ultra_hd":
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        String(24 + crfBump),
        "-b:v",
        "3M",
        ...wasmVp9,
      ];
    case "discord":
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        String(36 + crfBump),
        "-b:v",
        "700k",
        ...wasmVp9,
      ];
    case "email":
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        String(32 + crfBump),
        "-b:v",
        "1.2M",
        ...wasmVp9,
      ];
    default:
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        String(28 + crfBump),
        "-b:v",
        "2M",
        ...wasmVp9,
      ];
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
    config.exportMode !== "audio" &&
    (config.aspectMode === "shorts" ||
      !!config.watermark ||
      !!config.sticker ||
      (config.rotation ?? 0) !== 0 ||
      (config.crop ?? "none") !== "none" ||
      !!config.flipH ||
      (config.fadeIn ?? 0) > 0 ||
      (config.fadeOut ?? 0) > 0)
  );
}

function useVp8Encode(config: StudioExportConfig): boolean {
  return hasVideoEffects(config);
}

function isWasmMemoryError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /memory access out of bounds|out of memory|allocation failed|RuntimeError/i.test(
    msg,
  );
}

async function cutClip(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  inputName: string,
  start: number,
  duration: number,
  outputName: string,
  lightEncode = false,
): Promise<void> {
  const reencodeVideo = lightEncode
    ? ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1M"]
    : ["-c:v", "libvpx-vp9", "-b:v", "2M"];
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
        ...reencodeVideo,
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
  lightEncode = false,
): Promise<string> {
  if (segments.length === 1) {
    const s = segments[0];
    onProgress?.("Cutting segment…", 20);
    await cutClip(
      ffmpeg,
      inputName,
      s.start,
      s.end - s.start,
      "merged.webm",
      lightEncode,
    );
    return "merged.webm";
  }

  const clipNames: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const name = `clip${i}.webm`;
    onProgress?.(`Extracting clip ${i + 1}/${segments.length}…`, 15 + i * 5);
    await cutClip(ffmpeg, inputName, s.start, s.end - s.start, name, lightEncode);
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
    const mergeVideo = lightEncode
      ? ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "1M"]
      : ["-c:v", "libvpx-vp9", "-b:v", "2M"];
    await execChecked(
      ffmpeg,
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        ...mergeVideo,
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
  filterTier: FilterTier = "lite",
  mergedAudioName: string | null = null,
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
          x: sticker.x,
          y: sticker.y,
          rotation: sticker.rotation,
        }
      : undefined,
    watermarkInput: wm ? "1:v" : undefined,
    stickerInput: sticker ? (wm ? "2:v" : "1:v") : undefined,
    tier: filterTier,
  });
  const scaleOnly = !videoFilter ? scaleFilterForPreset(config.preset) : null;
  const vp8 = useVp8Encode(config);

  const args: string[] = ["-i", mergedName];
  if (wm) args.push("-i", "logo.png");
  if (sticker) args.push("-i", "sticker.png");
  if (mergedAudioName) args.push("-i", mergedAudioName);
  const audioMap = mergedAudioName
    ? `${1 + (wm ? 1 : 0) + (sticker ? 1 : 0)}:a?`
    : "0:a?";

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
    args.push("-map", audioMap);
  } else if (hasSpeed || scaleOnly) {
    const vf: string[] = [];
    if (scaleOnly) vf.push(scaleOnly);
    if (hasSpeed) vf.push(`setpts=PTS/${speed}`);
    args.push("-vf", vf.join(","));
    args.push("-map", "0:v");
    args.push("-map", audioMap);
  } else {
    args.push("-map", "0:v");
    args.push("-map", audioMap);
  }

  const audioChain = audioFilterChain(config.cleanAudio, config.voiceBoost);
  if (hasSpeed) {
    const tempo = buildAtempoChain(speed);
    const merged = [audioChain, tempo].filter(Boolean).join(",");
    if (merged) args.push("-af", merged);
  } else if (audioChain) {
    args.push("-af", audioChain);
  }

  args.push(...codecArgs(config.preset, attempt, vp8));
  args.push("-c:a", "libopus", "-b:a", "128k", outputName);

  onProgress?.("Encoding export…", 60 + attempt * 8);
  await execChecked(ffmpeg, args, "Encode");
  return (await ffmpeg.readFile(outputName)) as Uint8Array;
}

function segmentDuration(segments: { start: number; end: number }[]): number {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

function segmentsEqual(
  a: { start: number; end: number }[],
  b: { start: number; end: number }[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (s, i) =>
      Math.abs(s.start - b[i].start) < 0.001 &&
      Math.abs(s.end - b[i].end) < 0.001,
  );
}

async function cutAudioClip(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  inputName: string,
  start: number,
  duration: number,
  outputName: string,
): Promise<void> {
  await execChecked(
    ffmpeg,
    [
      "-ss",
      String(start),
      "-i",
      inputName,
      "-t",
      String(duration),
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
      outputName,
    ],
    "Cut audio",
  );
}

async function concatAudioSegments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  segments: { start: number; end: number }[],
  inputName: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  if (segments.length === 1) {
    const s = segments[0];
    onProgress?.("Cutting audio…", 22);
    await cutAudioClip(
      ffmpeg,
      inputName,
      s.start,
      s.end - s.start,
      "merged-audio.webm",
    );
    return "merged-audio.webm";
  }

  const clipNames: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const name = `aclip${i}.webm`;
    onProgress?.(`Extracting audio ${i + 1}/${segments.length}…`, 18 + i * 4);
    await cutAudioClip(ffmpeg, inputName, s.start, s.end - s.start, name);
    clipNames.push(name);
  }

  const list = clipNames.map((n) => `file '${n}'`).join("\n");
  await ffmpeg.writeFile("aconcat.txt", new TextEncoder().encode(list));
  await execChecked(
    ffmpeg,
    [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "aconcat.txt",
      "-c:a",
      "copy",
      "merged-audio.webm",
    ],
    "Merge audio",
  );

  for (const n of clipNames) await ffmpeg.deleteFile(n).catch(() => undefined);
  await ffmpeg.deleteFile("aconcat.txt").catch(() => undefined);
  return "merged-audio.webm";
}

async function tryEncodeWithTiers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any,
  config: StudioExportConfig,
  mergedName: string,
  totalDuration: number,
  onProgress?: ProgressCallback,
  mergedAudioName: string | null = null,
): Promise<{ data: Uint8Array; tier: FilterTier }> {
  const tiers: FilterTier[] = hasVideoEffects(config)
    ? effectFilterTiers()
    : ["standard"];

  let lastErr: unknown;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (i > 0) {
      onProgress?.(`Retrying export (${tier} quality)…`, 55 + i * 5);
    }
    try {
      const data = await encodeMerged(
        ffmpeg,
        config,
        mergedName,
        totalDuration,
        0,
        onProgress,
        tier,
        mergedAudioName,
      );
      return { data, tier };
    } catch (err) {
      lastErr = err;
      if (!isWasmMemoryError(err)) throw err;
    }
  }

  const fallbackTier = tiers[tiers.length - 1] ?? "minimal";
  try {
    const data = await encodeMerged(
      ffmpeg,
      config,
      mergedName,
      totalDuration,
      1,
      onProgress,
      fallbackTier,
      mergedAudioName,
    );
    return { data, tier: fallbackTier };
  } catch (err) {
    throw isWasmMemoryError(err) ? err : lastErr;
  }
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

  const lightEncode = useVp8Encode(config);

  await ffmpeg.writeFile(inputName, await fetchFile(blob));
  const mergedName = await concatSegments(
    ffmpeg,
    segments,
    inputName,
    onProgress,
    lightEncode,
  );

  const audioSegs = config.audioSegments?.filter((s) => s.end > s.start);
  const separateAudio =
    !!audioSegs &&
    audioSegs.length > 0 &&
    !segmentsEqual(segments, audioSegs);
  let mergedAudioName: string | null = null;
  if (separateAudio && audioSegs) {
    mergedAudioName = await concatAudioSegments(
      ffmpeg,
      audioSegs,
      inputName,
      onProgress,
    );
  }

  await ffmpeg.deleteFile(inputName).catch(() => undefined);

  if (config.watermark) {
    await ffmpeg.writeFile("logo.png", config.watermark.pngBytes);
  }
  if (config.sticker) {
    await ffmpeg.writeFile("sticker.png", config.sticker.pngBytes);
  }

  let data: Uint8Array;
  let filterTier: FilterTier = hasVideoEffects(config) ? "lite" : "standard";
  try {
    const encoded = await tryEncodeWithTiers(
      ffmpeg,
      config,
      mergedName,
      totalDuration,
      onProgress,
      mergedAudioName,
    );
    data = encoded.data;
    filterTier = encoded.tier;
  } catch (ffmpegErr) {
    await ffmpeg.deleteFile(mergedName).catch(() => undefined);
    if (config.watermark) await ffmpeg.deleteFile("logo.png").catch(() => undefined);
    if (config.sticker) await ffmpeg.deleteFile("sticker.png").catch(() => undefined);
    if (hasVideoEffects(config) && config.exportMode !== "audio") {
      onProgress?.("Switching to browser effects renderer…", 62);
      resetFfmpegLoader();
      const { exportStudioViaCanvas } = await import(
        "@/utils/studioCanvasExport"
      );
      return exportStudioViaCanvas(blob, config, onProgress);
    }
    throw ffmpegErr;
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
        filterTier,
        mergedAudioName,
      );
      result = toBlob(data, mime);
      attempt += 1;
    }
  }

  await ffmpeg.deleteFile(mergedName).catch(() => undefined);
  if (mergedAudioName) {
    await ffmpeg.deleteFile(mergedAudioName).catch(() => undefined);
  }
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
    if (hasVideoEffects(config) && config.exportMode !== "audio") {
      onProgress?.("Trying browser effects export…", 15);
      try {
        const { exportStudioViaCanvas } = await import(
          "@/utils/studioCanvasExport"
        );
        return await exportStudioViaCanvas(blob, config, onProgress);
      } catch (canvasErr) {
        throw exportError(
          canvasErr,
          "Effects export failed. Try a shorter clip or fewer effects.",
        );
      }
    }
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
