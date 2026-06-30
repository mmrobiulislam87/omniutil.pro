const FFMPEG_CORE_VERSION = "0.12.10";
const LOAD_TIMEOUT_MS = 120_000;

export type FfmpegProgressCallback = (message: string, ratio?: number) => void;

export type FfmpegBundle = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ffmpeg: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchFile: (data: any) => Promise<Uint8Array>;
};

type CoreSource = {
  label: string;
  base: string;
  /** Same-origin UMD can load directly; CDN needs toBlobURL for CORS. */
  useBlob: boolean;
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

function coreSources(): CoreSource[] {
  const cdn = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;
  const sources: CoreSource[] = [];
  if (typeof window !== "undefined") {
    sources.push({
      label: window.location.origin,
      base: `${window.location.origin}/ffmpeg`,
      useBlob: false,
    });
  }
  sources.push({ label: "cdn", base: cdn, useBlob: true });
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

async function resolveCoreUrls(
  base: string,
  useBlob: boolean,
  onProgress?: FfmpegProgressCallback,
): Promise<{ coreURL: string; wasmURL: string }> {
  const js = `${base}/ffmpeg-core.js`;
  const wasm = `${base}/ffmpeg-core.wasm`;

  if (!useBlob) {
    return { coreURL: js, wasmURL: wasm };
  }

  onProgress?.("Downloading video engine (~30 MB first time)…", 14);
  const { toBlobURL } = await import("@ffmpeg/util");
  return {
    coreURL: await toBlobURL(js, "text/javascript"),
    wasmURL: await toBlobURL(wasm, "application/wasm"),
  };
}

async function tryLoadFromSource(
  source: CoreSource,
  onProgress?: FfmpegProgressCallback,
): Promise<FfmpegBundle> {
  onProgress?.("Initializing ProStudio engine…", 10);

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }: { message: string }) => {
    lastFfmpegLog = message;
  });
  ffmpeg.on("progress", ({ progress }: { progress: number }) => {
    onProgress?.("Rendering…", Math.min(99, Math.round(progress * 100)));
  });

  const { coreURL, wasmURL } = await resolveCoreUrls(
    source.base,
    source.useBlob,
    onProgress,
  );

  await withTimeout(
    ffmpeg.load({ coreURL, wasmURL }),
    LOAD_TIMEOUT_MS,
    "Video engine load timed out. Check connection and try again.",
  );

  onProgress?.("Engine ready", 18);
  return { ffmpeg, fetchFile };
}

/**
 * Load ffmpeg.wasm (UMD core via importScripts in the bundled worker).
 * ESM core URLs fail with "Cannot find module" — no default export.
 */
export async function loadFfmpegEngine(
  onProgress?: FfmpegProgressCallback,
): Promise<FfmpegBundle> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      onProgress?.("Loading ProStudio engine…", 5);
      const errors: string[] = [];

      for (const source of coreSources()) {
        try {
          if (!source.useBlob) {
            const ok = await probeCore(source.base);
            if (!ok) {
              errors.push(`${source.label}: files not found (404)`);
              continue;
            }
          }
          return await tryLoadFromSource(source, onProgress);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${source.label}: ${msg}`);
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
