import {
  startBreakoutCompositor,
  startCanvasCompositor,
  supportsBreakoutCompositor,
  type CompositorHandle,
} from "@/utils/screenCompositor";

export type QualityPreset = "720p" | "1080p" | "1440p";
export type FrameRate = 30 | 60;
export type CameraPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";
export type CameraSize = "sm" | "md" | "lg";

export type RecorderOptions = {
  includeMic: boolean;
  includeCamera: boolean;
  includeSystemAudio: boolean;
  quality: QualityPreset;
  frameRate: FrameRate;
  micGain: number;
  systemGain: number;
  cameraPosition: CameraPosition;
  cameraSize: CameraSize;
  onBeforeStart?: () => Promise<void>;
};

export type RecordingSession = {
  stop: () => Promise<Blob>;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  getElapsedMs: () => number;
  getPausedMs: () => number;
};

const QUALITY_MAP: Record<
  QualityPreset,
  { width: number; height: number; bitrate: number }
> = {
  "720p": { width: 1280, height: 720, bitrate: 1_500_000 },
  "1080p": { width: 1920, height: 1080, bitrate: 2_500_000 },
  "1440p": { width: 2560, height: 1440, bitrate: 4_000_000 },
};

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return (
    candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm"
  );
}

type AudioMixer = {
  tracks: MediaStreamTrack[];
  context: AudioContext;
  keepAlive: ReturnType<typeof setInterval>;
  close: () => void;
};

function mixAudioTracks(
  sources: { track: MediaStreamTrack; gain: number }[],
): AudioMixer | null {
  const valid = sources.filter((s) => s.track.readyState === "live");
  if (valid.length === 0) return null;

  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();

  for (const { track, gain } of valid) {
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const gainNode = context.createGain();
    gainNode.gain.value = Math.max(0, Math.min(2, gain));
    source.connect(gainNode);
    gainNode.connect(destination);
  }

  void context.resume();

  const keepAlive = setInterval(() => {
    if (context.state === "suspended") void context.resume();
  }, 1500);

  return {
    tracks: destination.stream.getAudioTracks(),
    context,
    keepAlive,
    close: () => {
      clearInterval(keepAlive);
      void context.close();
    },
  };
}

async function attachStream(video: HTMLVideoElement, stream: MediaStream) {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}

export async function startScreenRecording(
  options: RecorderOptions,
): Promise<RecordingSession> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Screen recording is not supported in this browser. Try Chrome or Edge on desktop.",
    );
  }

  const spec = QUALITY_MAP[options.quality];
  const streamsToStop: MediaStream[] = [];
  let micStream: MediaStream | null = null;
  let cameraStream: MediaStream | null = null;
  let audioMixer: AudioMixer | null = null;

  try {
    // Acquire mic/camera BEFORE display picker so tracks stay live after share dialog.
    if (options.includeMic) {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamsToStop.push(micStream);
    }

    if (options.includeCamera) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamsToStop.push(cameraStream);
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: spec.width },
        height: { ideal: spec.height },
        frameRate: { ideal: options.frameRate },
      },
      audio: options.includeSystemAudio,
      // @ts-expect-error — Chrome prefersCurrentTab hint (ignored elsewhere)
      preferCurrentTab: false,
    });
    streamsToStop.push(displayStream);

    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) {
      throw new Error("No video track in screen capture.");
    }

    const screenVideo = document.createElement("video");
    await attachStream(screenVideo, displayStream);

    const width = screenVideo.videoWidth || spec.width;
    const height = screenVideo.videoHeight || spec.height;

    let videoStream: MediaStream;
    let compositor: CompositorHandle | null = null;
    const cameraTrack = cameraStream?.getVideoTracks()[0] ?? null;

    if (cameraTrack) {
      if (supportsBreakoutCompositor()) {
        compositor = startBreakoutCompositor(
          screenTrack,
          cameraTrack,
          width,
          height,
          options.cameraPosition,
          options.cameraSize,
        );
      } else {
        const cameraVideo = document.createElement("video");
        await attachStream(cameraVideo, cameraStream!);
        compositor = startCanvasCompositor(
          screenVideo,
          cameraVideo,
          width,
          height,
          options.frameRate,
          options.cameraPosition,
          options.cameraSize,
        );
      }
      videoStream = compositor.stream;
    } else {
      videoStream = new MediaStream([screenTrack]);
    }

    const audioSources: { track: MediaStreamTrack; gain: number }[] = [];
    if (options.includeSystemAudio) {
      for (const track of displayStream.getAudioTracks()) {
        audioSources.push({ track, gain: options.systemGain });
      }
    }
    if (micStream) {
      for (const track of micStream.getAudioTracks()) {
        audioSources.push({ track, gain: options.micGain });
      }
    }

    audioMixer = mixAudioTracks(audioSources);

    const finalStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioMixer?.tracks ?? []),
    ]);

    const mimeType = pickMimeType();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(finalStream, {
      mimeType,
      videoBitsPerSecond: spec.bitrate,
      audioBitsPerSecond: 128_000,
    });

    const startedAt = Date.now();
    let pausedAt: number | null = null;
    let totalPausedMs = 0;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const recorderDone = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
      };
    });

    await options.onBeforeStart?.();
    recorder.start(250);

    screenTrack.addEventListener("ended", () => {
      if (recorder.state === "recording") recorder.stop();
    });

    return {
      getElapsedMs: () => {
        const now = Date.now();
        const pauseExtra = pausedAt != null ? now - pausedAt : 0;
        return now - startedAt - totalPausedMs - pauseExtra;
      },
      getPausedMs: () => totalPausedMs,
      isPaused: () => recorder.state === "paused",
      pause: () => {
        if (recorder.state !== "recording") return;
        recorder.pause();
        pausedAt = Date.now();
      },
      resume: () => {
        if (recorder.state !== "paused" || pausedAt == null) return;
        totalPausedMs += Date.now() - pausedAt;
        pausedAt = null;
        recorder.resume();
        void audioMixer?.context.resume();
      },
      stop: async () => {
        if (recorder.state === "recording" || recorder.state === "paused") {
          recorder.stop();
        }
        compositor?.stop();
        screenVideo.srcObject = null;
        audioMixer?.close();
        for (const stream of streamsToStop) {
          for (const track of stream.getTracks()) track.stop();
        }
        for (const track of finalStream.getTracks()) track.stop();
        return recorderDone;
      },
    };
  } catch (error) {
    audioMixer?.close();
    for (const stream of streamsToStop) {
      for (const track of stream.getTracks()) track.stop();
    }
    throw error;
  }
}

export function formatRecordingTime(ms: number, showMs = false): string {
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const frac = showMs ? `.${String(Math.floor((totalSec % 1) * 10))}` : "";
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${frac}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${frac}`;
}

export const QUALITY_PRESETS: { id: QualityPreset; label: string }[] = [
  { id: "720p", label: "720p HD" },
  { id: "1080p", label: "1080p Full HD" },
  { id: "1440p", label: "1440p QHD" },
];

export const FRAME_RATES: FrameRate[] = [30, 60];

export const CAMERA_POSITIONS: { id: CameraPosition; label: string }[] = [
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "top-right", label: "Top right" },
  { id: "top-left", label: "Top left" },
];

export const CAMERA_SIZES: { id: CameraSize; label: string }[] = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

export const CAPTURE_GUIDE = [
  "To record YouTube or other sites: choose Entire Screen or Window — not this recorder tab.",
  "Or open the target site in another tab first, then share that specific tab.",
  "Do not navigate away from this page in the same tab — it stops the recorder.",
  "A floating control window opens while recording — keep it open.",
] as const;
