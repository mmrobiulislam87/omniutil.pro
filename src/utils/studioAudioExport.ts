import type { StudioExportConfig } from "@/utils/proStudioExport";

type ProgressCallback = (message: string, ratio?: number) => void;
type Segment = { start: number; end: number };

function activeAudioSegments(
  config: StudioExportConfig,
): Segment[] {
  const segs = config.audioSegments ?? config.segments;
  return segs.filter((s) => s.end > s.start);
}

function pickAudioMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";
}

function waitSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = () => reject(new Error("Seek failed while extracting audio."));
    video.addEventListener("error", onErr, { once: true });
    video.onseeked = () => {
      video.removeEventListener("error", onErr);
      resolve();
    };
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

async function loadVideo(blob: Blob): Promise<{ video: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";
  video.muted = false;
  video.volume = 1;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not load recording for audio."));
  });

  return { video, url };
}

function disposeVideo(video: HTMLVideoElement, url: string) {
  video.pause();
  video.removeAttribute("src");
  video.load();
  URL.revokeObjectURL(url);
}

async function playSegment(
  video: HTMLVideoElement,
  start: number,
  end: number,
  speed: number,
): Promise<void> {
  await waitSeek(video, start);
  video.playbackRate = speed;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.pause();
      video.removeEventListener("timeupdate", onTime);
      clearTimeout(timeout);
      resolve();
    };

    const onTime = () => {
      if (video.currentTime >= end - 0.08) finish();
    };

    const timeout = setTimeout(
      () => finish(),
      ((end - start) / speed) * 1000 + 3000,
    );

    video.addEventListener("timeupdate", onTime);
    video.play().catch((err) => {
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/** WASM-free — routes element audio through Web Audio into MediaRecorder. */
async function recordViaWebAudio(
  video: HTMLVideoElement,
  segments: Segment[],
  speed: number,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const mimeType = pickAudioMime();
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error("This browser cannot export audio-only WebM.");
  }

  const audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaElementSource(video);
  const destination = audioCtx.createMediaStreamDestination();
  source.connect(destination);

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(destination.stream, {
    mimeType,
    audioBitsPerSecond: 128_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Audio recording failed."));
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mimeType.split(";")[0] || "audio/webm" }));
  });

  recorder.start(250);

  for (let i = 0; i < segments.length; i++) {
    onProgress?.(
      `Recording audio ${i + 1}/${segments.length}…`,
      15 + ((i + 1) / segments.length) * 80,
    );
    await playSegment(video, segments[i].start, segments[i].end, speed);
  }

  await new Promise((r) => setTimeout(r, 300));
  recorder.stop();
  const result = await recorded;
  await audioCtx.close();

  if (result.size < 512) {
    throw new Error(
      "No audio captured. Make sure the recording includes sound, then try Export again.",
    );
  }
  return result;
}

/** Fallback when Web Audio graph cannot be created. */
async function recordViaCaptureStream(
  video: HTMLVideoElement,
  segments: Segment[],
  speed: number,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const cap = (
    video as HTMLVideoElement & { captureStream?: () => MediaStream }
  ).captureStream?.();
  const audioTrack = cap?.getAudioTracks()[0];
  if (!audioTrack) {
    throw new Error("This recording has no audio track.");
  }

  const mimeType = pickAudioMime();
  const stream = new MediaStream([audioTrack]);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Audio recording failed."));
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mimeType.split(";")[0] || "audio/webm" }));
  });

  recorder.start(250);
  for (let i = 0; i < segments.length; i++) {
    onProgress?.(
      `Recording audio ${i + 1}/${segments.length}…`,
      15 + ((i + 1) / segments.length) * 80,
    );
    await playSegment(video, segments[i].start, segments[i].end, speed);
  }

  await new Promise((r) => setTimeout(r, 300));
  recorder.stop();
  const result = await recorded;
  if (result.size < 512) {
    throw new Error("No audio captured from this recording.");
  }
  return result;
}

/** Browser-native audio export — no ffmpeg / WASM. */
export async function exportAudioInBrowser(
  blob: Blob,
  config: StudioExportConfig,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const segments = activeAudioSegments(config);
  if (segments.length === 0) throw new Error("No audio segments to export.");

  onProgress?.("Extracting audio in browser…", 8);
  const { video, url } = await loadVideo(blob);

  try {
    const speed = config.speed ?? 1;
    try {
      return await recordViaWebAudio(video, segments, speed, onProgress);
    } catch (webAudioErr) {
      onProgress?.("Trying alternate browser capture…", 12);
      try {
        return await recordViaCaptureStream(video, segments, speed, onProgress);
      } catch {
        if (webAudioErr instanceof Error) throw webAudioErr;
        throw new Error("Browser audio extract failed.");
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      throw new Error(
        "Playback was blocked. Click Export audio again to allow capture.",
      );
    }
    throw err;
  } finally {
    disposeVideo(video, url);
  }
}
