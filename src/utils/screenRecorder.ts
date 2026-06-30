export type RecorderOptions = {
  includeMic: boolean;
  includeCamera: boolean;
};

export type RecordingSession = {
  stop: () => Promise<Blob>;
  getElapsedMs: () => number;
};

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

function mixAudioTracks(tracks: MediaStreamTrack[]): MediaStreamTrack[] {
  if (tracks.length === 0) return [];
  if (tracks.length === 1) return tracks;

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  for (const track of tracks) {
    const source = audioContext.createMediaStreamSource(
      new MediaStream([track]),
    );
    source.connect(destination);
  }

  return destination.stream.getAudioTracks();
}

type Compositor = {
  stream: MediaStream;
  stop: () => void;
};

function startCompositor(
  screenVideo: HTMLVideoElement,
  cameraVideo: HTMLVideoElement | null,
  width: number,
  height: number,
): Compositor {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  let frameId = 0;
  const draw = () => {
    ctx.drawImage(screenVideo, 0, 0, width, height);
    if (cameraVideo && cameraVideo.readyState >= 2) {
      const pw = Math.round(width * 0.22);
      const ph = Math.round((pw * cameraVideo.videoHeight) / cameraVideo.videoWidth || pw * 0.75);
      const pad = 16;
      const x = width - pw - pad;
      const y = height - ph - pad;
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, pw, ph, 12);
      } else {
        ctx.rect(x, y, pw, ph);
      }
      ctx.clip();
      ctx.drawImage(cameraVideo, x, y, pw, ph);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    frameId = requestAnimationFrame(draw);
  };
  draw();

  return {
    stream: canvas.captureStream(30),
    stop: () => cancelAnimationFrame(frameId),
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

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: true,
  });

  const streamsToStop: MediaStream[] = [displayStream];
  let micStream: MediaStream | null = null;
  let cameraStream: MediaStream | null = null;

  try {
    if (options.includeMic) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsToStop.push(micStream);
    }
    if (options.includeCamera) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: "user",
        },
        audio: false,
      });
      streamsToStop.push(cameraStream);
    }

    const screenVideo = document.createElement("video");
    await attachStream(screenVideo, displayStream);

    const width = screenVideo.videoWidth || 1920;
    const height = screenVideo.videoHeight || 1080;

    let videoStream: MediaStream;
    let compositor: Compositor | null = null;

    if (cameraStream) {
      const cameraVideo = document.createElement("video");
      await attachStream(cameraVideo, cameraStream);
      compositor = startCompositor(screenVideo, cameraVideo, width, height);
      videoStream = compositor.stream;
    } else {
      videoStream = new MediaStream(displayStream.getVideoTracks());
    }

    const audioTracks = mixAudioTracks([
      ...displayStream.getAudioTracks(),
      ...(micStream?.getAudioTracks() ?? []),
    ]);

    const finalStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const mimeType = pickMimeType();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(finalStream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });

    const startedAt = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const recorderDone = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
      };
    });

    recorder.start(1000);

    const stopDisplayTrack = displayStream.getVideoTracks()[0];
    stopDisplayTrack?.addEventListener("ended", () => {
      if (recorder.state === "recording") recorder.stop();
    });

    return {
      getElapsedMs: () => Date.now() - startedAt,
      stop: async () => {
        if (recorder.state === "recording") recorder.stop();
        compositor?.stop();
        screenVideo.srcObject = null;
        for (const stream of streamsToStop) {
          for (const track of stream.getTracks()) track.stop();
        }
        for (const track of finalStream.getTracks()) track.stop();
        return recorderDone;
      },
    };
  } catch (error) {
    for (const stream of streamsToStop) {
      for (const track of stream.getTracks()) track.stop();
    }
    throw error;
  }
}

export function formatRecordingTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
