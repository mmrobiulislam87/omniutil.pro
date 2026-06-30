import { trimVideoInBrowser } from "@/utils/videoProbe";

const FFMPEG_CORE_VERSION = "0.12.10";

export type ExportQuality = "high" | "balanced" | "compact";
export type ExportMode = "video" | "audio";

export type VideoExportOptions = {
  startSec: number;
  endSec: number;
  muteAudio?: boolean;
  speed?: number;
  quality?: ExportQuality;
  mode?: ExportMode;
};

type ProgressCallback = (message: string, ratio?: number) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<any> | null = null;

const QUALITY_BITRATE: Record<ExportQuality, string> = {
  high: "4M",
  balanced: "2M",
  compact: "1M",
};

async function loadFfmpeg(onProgress?: ProgressCallback) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }: { progress: number }) => {
        onProgress?.("Processing…", Math.round(progress * 100));
      });

      onProgress?.("Loading video engine (first export)…", 5);
      const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${base}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
      });

      return { ffmpeg, fetchFile };
    })();
  }
  return ffmpegPromise;
}

function buildAtempoFilter(speed: number): string {
  if (speed === 1) return "";
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
  if (remaining !== 1) filters.push(`atempo=${remaining}`);
  return filters.join(",");
}

function toBlob(data: Uint8Array | string, mime: string): Blob {
  if (typeof data === "string") {
    return new Blob([data], { type: mime });
  }
  return new Blob([new Uint8Array(data)], { type: mime });
}

export async function exportVideo(
  blob: Blob,
  options: VideoExportOptions,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const { startSec, endSec } = options;
  if (endSec <= startSec) {
    throw new Error("End time must be after start time.");
  }

  const speed = options.speed ?? 1;
  const quality = options.quality ?? "balanced";
  const mode = options.mode ?? "video";
  const muteAudio = options.muteAudio ?? false;
  const duration = (endSec - startSec) / speed;

  const { ffmpeg, fetchFile } = await loadFfmpeg(onProgress);
  const inputName = "input.webm";
  const outputName = mode === "audio" ? "output.webm" : "output.webm";

  await ffmpeg.writeFile(inputName, await fetchFile(blob));
  onProgress?.("Processing clip…", 15);

  const args: string[] = [
    "-ss",
    String(startSec),
    "-i",
    inputName,
    "-t",
    String(endSec - startSec),
  ];

  if (mode === "audio") {
    args.push("-vn", "-c:a", "libopus", "-b:a", "128k", outputName);
  } else if (speed !== 1) {
    args.push("-filter:v", `setpts=PTS/${speed}`);
    if (!muteAudio) {
      const audioFilter = buildAtempoFilter(speed);
      if (audioFilter) args.push("-filter:a", audioFilter);
    }
    args.push(
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      QUALITY_BITRATE[quality],
    );
    if (muteAudio) args.push("-an");
    else args.push("-c:a", "libopus", "-b:a", "128k");
    args.push(outputName);
  } else if (muteAudio) {
    args.push("-c:v", "libvpx-vp9", "-b:v", QUALITY_BITRATE[quality], "-an", outputName);
  } else {
    args.push("-c", "copy", outputName);
  }

  let exitCode = await ffmpeg.exec(args);

  if (exitCode !== 0 && mode === "video" && speed === 1 && !muteAudio) {
    onProgress?.("Re-encoding for clean cut…", 40);
    exitCode = await ffmpeg.exec([
      "-ss",
      String(startSec),
      "-i",
      inputName,
      "-t",
      String(endSec - startSec),
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      QUALITY_BITRATE[quality],
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
      outputName,
    ]);
  }

  if (exitCode !== 0) {
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);

    if (mode === "video" && speed === 1 && !muteAudio) {
      onProgress?.("ffmpeg unavailable — trimming in browser…", 10);
      return trimVideoInBrowser(blob, startSec, endSec, onProgress);
    }
    throw new Error("Video export failed. Try a shorter clip or use Raw WebM.");
  }

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  onProgress?.("Done", 100);
  const mime = mode === "audio" ? "audio/webm" : "video/webm";
  return toBlob(data as Uint8Array, mime);
}

/** @deprecated Use exportVideo */
export async function trimVideoBlob(
  blob: Blob,
  startSec: number,
  endSec: number,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  return exportVideo(blob, { startSec, endSec }, onProgress);
}

export const EXPORT_QUALITIES: { id: ExportQuality; label: string; hint: string }[] = [
  { id: "high", label: "High", hint: "Best quality · larger file" },
  { id: "balanced", label: "Balanced", hint: "Recommended" },
  { id: "compact", label: "Compact", hint: "Smaller file · faster share" },
];

export const SPEED_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1×" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2×" },
];

export function estimateExportDuration(
  startSec: number,
  endSec: number,
  speed: number,
): number {
  return (endSec - startSec) / speed;
}
