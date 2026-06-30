import { trimVideoInBrowser } from "@/utils/videoProbe";
import {
  overlayCoords,
  type WatermarkPosition,
} from "@/utils/watermarkCanvas";

const FFMPEG_CORE_VERSION = "0.12.10";

export type ExportPreset = "ultra_hd" | "discord" | "email" | "balanced";
export type AspectMode = "landscape" | "shorts";

export type StudioExportConfig = {
  segments: { start: number; end: number }[];
  aspectMode: AspectMode;
  cleanAudio: boolean;
  voiceBoost: boolean;
  speed: number;
  preset: ExportPreset;
  watermark?: {
    pngBytes: Uint8Array;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
  };
};

type ProgressCallback = (message: string, ratio?: number) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<any> | null = null;

async function loadFfmpeg(onProgress?: ProgressCallback) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }: { progress: number }) => {
        onProgress?.("Rendering…", Math.min(99, Math.round(progress * 100)));
      });
      onProgress?.("Loading ProStudio engine…", 8);
      const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return { ffmpeg, fetchFile };
    })();
  }
  return ffmpegPromise;
}

function toBlob(data: Uint8Array, mime: string): Blob {
  return new Blob([new Uint8Array(data)], { type: mime });
}

function presetEncodeArgs(preset: ExportPreset, attempt = 0): string[] {
  const extraCrf = attempt * 6;
  switch (preset) {
    case "ultra_hd":
      return ["-c:v", "libvpx-vp9", "-crf", String(20 + extraCrf), "-b:v", "0"];
    case "discord":
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        String(34 + extraCrf),
        "-b:v",
        "800k",
        "-vf",
        "scale='min(1280,iw)':-2",
      ];
    case "email":
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        String(30 + extraCrf),
        "-b:v",
        "1500k",
      ];
    default:
      return ["-c:v", "libvpx-vp9", "-crf", String(28 + extraCrf), "-b:v", "2M"];
  }
}

function audioFilterArgs(clean: boolean, boost: boolean): string[] {
  if (!clean && !boost) return [];
  const filters: string[] = [];
  if (clean) filters.push("highpass=f=100", "lowpass=f=10000", "afftdn=nf=-25");
  if (boost) filters.push("volume=1.45");
  return ["-af", filters.join(",")];
}

function shortsFilter(): string {
  return [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:8[bg]",
    "[0:v]scale=1080:-2:force_original_aspect_ratio=decrease,crop=1080:1920[crop]",
    "[bg][crop]overlay=(W-w)/2:(H-h)/2[outv]",
  ].join(";");
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
    await ffmpeg.exec([
      "-ss",
      String(s.start),
      "-i",
      inputName,
      "-t",
      String(s.end - s.start),
      "-c",
      "copy",
      "merged.webm",
    ]);
    return "merged.webm";
  }

  const clipNames: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const name = `clip${i}.webm`;
    onProgress?.(`Extracting clip ${i + 1}/${segments.length}…`, 15 + i * 5);
    await ffmpeg.exec([
      "-ss",
      String(s.start),
      "-i",
      inputName,
      "-t",
      String(s.end - s.start),
      "-c",
      "copy",
      name,
    ]);
    clipNames.push(name);
  }

  const list = clipNames.map((n) => `file '${n}'`).join("\n");
  await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(list));
  onProgress?.("Merging segments…", 45);
  await ffmpeg.exec([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "concat.txt",
    "-c",
    "copy",
    "merged.webm",
  ]);

  for (const n of clipNames) await ffmpeg.deleteFile(n).catch(() => undefined);
  await ffmpeg.deleteFile("concat.txt").catch(() => undefined);
  return "merged.webm";
}

export async function renderStudioExport(
  blob: Blob,
  config: StudioExportConfig,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const segments = config.segments.filter((s) => s.end > s.start);
  if (segments.length === 0) throw new Error("No segments to export.");

  if (segments.length === 1 && config.aspectMode === "landscape" && !config.watermark && !config.cleanAudio && !config.voiceBoost && config.speed === 1 && config.preset === "balanced") {
    const s = segments[0];
    return trimVideoInBrowser(blob, s.start, s.end, onProgress);
  }

  const { ffmpeg, fetchFile } = await loadFfmpeg(onProgress);
  const inputName = "input.webm";
  await ffmpeg.writeFile(inputName, await fetchFile(blob));

  const mergedName = await concatSegments(ffmpeg, segments, inputName, onProgress);

  if (config.watermark) {
    await ffmpeg.writeFile("logo.png", config.watermark.pngBytes);
  }

  const wm = config.watermark;
  const wmOpacity = wm?.opacity ?? 0.85;
  const wmScale = wm?.scale ?? 0.14;
  const wmPos = wm ? overlayCoords(wm.position) : "";

  let videoFilter = "";
  if (config.aspectMode === "shorts" && wm) {
    videoFilter = `${shortsFilter().replace("[outv]", "[base]")};[1:v]format=rgba,colorchannelmixer=aa=${wmOpacity},scale=iw*${wmScale}:-1[logo];[base][logo]overlay=${wmPos}[outv]`;
  } else if (config.aspectMode === "shorts") {
    videoFilter = shortsFilter();
  } else if (wm) {
    videoFilter = `[1:v]format=rgba,colorchannelmixer=aa=${wmOpacity},scale=iw*${wmScale}:-1[logo];[0:v][logo]overlay=${wmPos}[outv]`;
  }

  const speed = config.speed;
  const hasSpeed = speed !== 1;
  const inputs = wm ? ["-i", mergedName, "-i", "logo.png"] : ["-i", mergedName];

  const tryEncode = async (attempt: number): Promise<Uint8Array> => {
    const outputName = "final.webm";
    const args: string[] = [...inputs];

    if (videoFilter) {
      if (hasSpeed) {
        args.push("-filter_complex", `${videoFilter.replace("[outv]", "[v]")};[v]setpts=PTS/${speed}[outv]`);
      } else {
        args.push("-filter_complex", videoFilter);
      }
      args.push("-map", "[outv]");
      args.push("-map", "0:a?");
    } else if (hasSpeed) {
      args.push("-filter:v", `setpts=PTS/${speed}`);
    }

    const audioArgs = audioFilterArgs(config.cleanAudio, config.voiceBoost);
    if (hasSpeed && audioArgs.length === 0) {
      args.push("-filter:a", `atempo=${Math.min(2, Math.max(0.5, speed))}`);
    } else if (hasSpeed && audioArgs.length > 0) {
      const af = audioArgs[1] + `,atempo=${Math.min(2, Math.max(0.5, speed))}`;
      args.push("-af", af);
    } else {
      args.push(...audioArgs);
    }

    args.push(...presetEncodeArgs(config.preset, attempt));
    args.push("-c:a", "libopus", "-b:a", "128k", outputName);

    onProgress?.("Encoding export…", 60 + attempt * 10);
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error("Encode failed");
    return (await ffmpeg.readFile(outputName)) as Uint8Array;
  };

  let data: Uint8Array;
  try {
    data = await tryEncode(0);
  } catch {
    data = await tryEncode(1);
  }

  let result = toBlob(data, "video/webm");

  const maxBytes =
    config.preset === "discord"
      ? 8 * 1024 * 1024
      : config.preset === "email"
        ? 25 * 1024 * 1024
        : Infinity;

  let attempt = 1;
  while (result.size > maxBytes && attempt < 4) {
    onProgress?.(`Compressing for ${config.preset}…`, 70 + attempt * 5);
    data = await tryEncode(attempt);
    result = toBlob(data, "video/webm");
    attempt += 1;
  }

  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile(mergedName).catch(() => undefined);
  if (wm) await ffmpeg.deleteFile("logo.png").catch(() => undefined);

  onProgress?.("Done", 100);
  return result;
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
