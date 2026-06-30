const FFMPEG_CORE_VERSION = "0.12.10";

export type FfmpegProgressCallback = (message: string, ratio?: number) => void;

export type FfmpegBundle = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchFile: (data: any) => Promise<Uint8Array>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<FfmpegBundle> | null = null;
let lastFfmpegLog = "";

export function resetFfmpegLoader(): void {
  ffmpegPromise = null;
}

export function getLastFfmpegLog(): string {
  return lastFfmpegLog;
}

function coreSources(): string[] {
  const sources: string[] = [];
  if (typeof window !== "undefined") {
    sources.push(`${window.location.origin}/ffmpeg`);
  }
  sources.push(
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`,
  );
  return sources;
}

function classWorkerUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/ffmpeg/class-worker.js`;
}

async function tryLoadFromBase(
  base: string,
  onProgress?: FfmpegProgressCallback,
): Promise<FfmpegBundle> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }: { message: string }) => {
    lastFfmpegLog = message;
  });
  ffmpeg.on("progress", ({ progress }: { progress: number }) => {
    onProgress?.("Rendering…", Math.min(99, Math.round(progress * 100)));
  });

  const workerURL = classWorkerUrl();
  const loadConfig: {
    coreURL: string;
    wasmURL: string;
    classWorkerURL?: string;
  } = {
    coreURL: `${base}/ffmpeg-core.js`,
    wasmURL: `${base}/ffmpeg-core.wasm`,
  };

  if (workerURL && base.startsWith(window.location.origin)) {
    loadConfig.classWorkerURL = workerURL;
  }

  await ffmpeg.load(loadConfig);
  return { ffmpeg, fetchFile };
}

/**
 * Load ffmpeg.wasm using same-origin static files (no blob URLs).
 * Blob-based coreURL breaks dynamic import() in production workers.
 */
export async function loadFfmpegEngine(
  onProgress?: FfmpegProgressCallback,
): Promise<FfmpegBundle> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      onProgress?.("Loading ProStudio engine…", 5);
      const errors: string[] = [];

      for (const base of coreSources()) {
        try {
          return await tryLoadFromBase(base, onProgress);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${base}: ${msg}`);
        }
      }

      resetFfmpegLoader();
      throw new Error(
        `Could not load video engine. ${errors.join(" | ")}`,
      );
    })();
  }
  return ffmpegPromise;
}
