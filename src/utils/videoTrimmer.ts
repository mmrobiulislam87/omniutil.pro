const FFMPEG_CORE_VERSION = "0.12.10";

type ProgressCallback = (message: string, ratio?: number) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<any> | null = null;

async function loadFfmpeg(onProgress?: ProgressCallback) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }: { message: string }) => {
        if (message.includes("time=")) onProgress?.(message);
      });
      ffmpeg.on("progress", ({ progress }: { progress: number }) => {
        onProgress?.("Trimming video…", Math.round(progress * 100));
      });

      onProgress?.("Loading video engine (first trim only)…", 5);
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

export async function trimVideoBlob(
  blob: Blob,
  startSec: number,
  endSec: number,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  if (endSec <= startSec) {
    throw new Error("End time must be after start time.");
  }

  const { ffmpeg, fetchFile } = await loadFfmpeg(onProgress);
  const inputName = "input.webm";
  const outputName = "output.webm";

  await ffmpeg.writeFile(inputName, await fetchFile(blob));

  onProgress?.("Trimming…", 20);
  const duration = endSec - startSec;
  const exitCode = await ffmpeg.exec([
    "-ss",
    String(startSec),
    "-i",
    inputName,
    "-t",
    String(duration),
    "-c",
    "copy",
    outputName,
  ]);

  if (exitCode !== 0) {
    onProgress?.("Re-encoding trimmed segment…", 40);
    const fallbackCode = await ffmpeg.exec([
      "-ss",
      String(startSec),
      "-i",
      inputName,
      "-t",
      String(duration),
      "-c:v",
      "libvpx-vp9",
      "-c:a",
      "libopus",
      "-b:v",
      "2M",
      outputName,
    ]);
    if (fallbackCode !== 0) {
      throw new Error("Failed to trim video.");
    }
  }

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  onProgress?.("Done", 100);
  return new Blob([data], { type: "video/webm" });
}
