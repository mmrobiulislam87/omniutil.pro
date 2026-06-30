const FFMPEG_CORE_VERSION = "0.12.10";
const LOAD_TIMEOUT_MS = 120_000;

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

async function probeCore(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/ffmpeg-core.js`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function tryLoadFromBase(
  base: string,
  onProgress?: FfmpegProgressCallback,
): Promise<FfmpegBundle> {
  onProgress?.("Downloading video engine (~30 MB first time)…", 12);

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }: { message: string }) => {
    lastFfmpegLog = message;
  });
  ffmpeg.on("progress", ({ progress }: { progress: number }) => {
    onProgress?.("Rendering…", Math.min(99, Math.round(progress * 100)));
  });

  // Do NOT set classWorkerURL — the copied public worker breaks (missing ./const.js).
  // Webpack bundles @ffmpeg/ffmpeg's worker.js correctly from the app chunk.
  await withTimeout(
    ffmpeg.load({
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
    }),
    LOAD_TIMEOUT_MS,
    "Video engine load timed out. Check connection and try again.",
  );

  onProgress?.("Engine ready", 18);
  return { ffmpeg, fetchFile };
}

/**
 * Load ffmpeg.wasm using same-origin static files (no blob URLs).
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
          if (base.startsWith(window.location.origin)) {
            const ok = await probeCore(base);
            if (!ok) {
              errors.push(`${base}: files not found (404)`);
              continue;
            }
          }
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
