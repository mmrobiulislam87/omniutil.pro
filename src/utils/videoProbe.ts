/** Probe duration for WebM blobs where metadata duration is often missing/wrong. */
export function probeVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    let settled = false;
    const finish = (seconds: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.src = "";
      video.load();
      if (seconds > 0 && Number.isFinite(seconds)) resolve(seconds);
      else reject(new Error("Invalid video duration"));
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata"));
    };

    video.onerror = fail;

    video.onloadedmetadata = () => {
      const d = video.duration;
      if (Number.isFinite(d) && d > 0 && d !== Infinity) {
        finish(d);
        return;
      }
      video.currentTime = 1e7;
    };

    video.onseeked = () => {
      if (!settled && video.currentTime > 0) {
        finish(video.currentTime);
      }
    };

    video.load();
  });
}

function pickRecorderMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

/** Browser-native trim — no ffmpeg, works when WASM export fails. */
export async function trimVideoInBrowser(
  blob: Blob,
  startSec: number,
  endSec: number,
  onProgress?: (message: string, ratio?: number) => void,
): Promise<Blob> {
  if (endSec <= startSec) {
    throw new Error("End time must be after start time.");
  }

  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.muted = false;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video for trim."));
  });

  const mimeType = pickRecorderMime();
  const chunks: Blob[] = [];

  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = startSec;
  });

  const stream = (
    video as HTMLVideoElement & { captureStream: () => MediaStream }
  ).captureStream();
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Browser trim failed."));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    };
  });

  onProgress?.("Trimming in browser…", 30);
  recorder.start(200);
  await video.play();

  const clipMs = (endSec - startSec) * 1000;
  const started = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - started;
      const ratio = Math.min(95, 30 + (elapsed / clipMs) * 65);
      onProgress?.("Trimming in browser…", Math.round(ratio));
      if (video.currentTime >= endSec - 0.05 || elapsed >= clipMs + 2000) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  recorder.stop();
  video.pause();
  URL.revokeObjectURL(url);

  onProgress?.("Done", 100);
  return done;
}
