import type {
  CameraPosition,
  CameraSize,
  FrameRate,
} from "@/utils/screenRecorder";

const CAMERA_SCALE: Record<CameraSize, number> = {
  sm: 0.16,
  md: 0.22,
  lg: 0.28,
};

function cameraRect(
  width: number,
  height: number,
  camW: number,
  camH: number,
  position: CameraPosition,
  pad: number,
) {
  const positions: Record<CameraPosition, { x: number; y: number }> = {
    "bottom-right": { x: width - camW - pad, y: height - camH - pad },
    "bottom-left": { x: pad, y: height - camH - pad },
    "top-right": { x: width - camW - pad, y: pad },
    "top-left": { x: pad, y: pad },
  };
  return positions[position];
}

function drawCameraOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  width: number,
  height: number,
  cameraPosition: CameraPosition,
  cameraSize: CameraSize,
) {
  const scale = CAMERA_SCALE[cameraSize];
  const pw = Math.round(width * scale);
  const ph = Math.round((pw * sh) / sw || pw * 0.75);
  const pad = Math.round(width * 0.012);
  const { x, y } = cameraRect(width, height, pw, ph, cameraPosition, pad);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, pw, ph, 14);
  } else {
    ctx.rect(x, y, pw, ph);
  }
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.clip();
  ctx.drawImage(source, x, y, pw, ph);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 14);
    ctx.stroke();
  }
}

export type CompositorHandle = {
  stream: MediaStream;
  stop: () => void;
};

type VideoTrackGenerator = MediaStreamTrack & {
  writable: WritableStream<VideoFrame>;
};

type BreakoutGlobals = typeof globalThis & {
  MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => {
    readable: ReadableStream<VideoFrame>;
  };
  MediaStreamTrackGenerator?: new (init: {
    kind: "video";
  }) => VideoTrackGenerator;
};

function breakoutApi(): BreakoutGlobals {
  return globalThis as BreakoutGlobals;
}

export function supportsBreakoutCompositor(): boolean {
  const g = breakoutApi();
  return (
    typeof g.MediaStreamTrackProcessor !== "undefined" &&
    typeof g.MediaStreamTrackGenerator !== "undefined" &&
    typeof VideoFrame !== "undefined"
  );
}

/** Frame-pipeline compositor — keeps working when the recorder tab is in the background. */
export function startBreakoutCompositor(
  screenTrack: MediaStreamTrack,
  cameraTrack: MediaStreamTrack,
  width: number,
  height: number,
  cameraPosition: CameraPosition,
  cameraSize: CameraSize,
): CompositorHandle {
  const { MediaStreamTrackProcessor, MediaStreamTrackGenerator } = breakoutApi();
  if (!MediaStreamTrackProcessor || !MediaStreamTrackGenerator) {
    throw new Error("Breakout Box API unavailable.");
  }

  const screenProcessor = new MediaStreamTrackProcessor({ track: screenTrack });
  const cameraProcessor = new MediaStreamTrackProcessor({ track: cameraTrack });
  const generator = new MediaStreamTrackGenerator({ kind: "video" });
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas unavailable.");

  let stopped = false;
  const camBuffer: { frame: VideoFrame | null } = { frame: null };
  const camReader = cameraProcessor.readable.getReader();
  const screenReader = screenProcessor.readable.getReader();
  const writer = generator.writable.getWriter();

  const camLoop = (async () => {
    try {
      while (!stopped) {
        const { value, done } = await camReader.read();
        if (done) break;
        if (value) {
          if (camBuffer.frame) camBuffer.frame.close();
          camBuffer.frame = value;
        }
      }
    } catch {
      /* track ended */
    } finally {
      camReader.releaseLock();
    }
  })();

  const mainLoop = (async () => {
    try {
      while (!stopped) {
        const { value: screenFrame, done } = await screenReader.read();
        if (done || !screenFrame) break;

        ctx.drawImage(screenFrame, 0, 0, width, height);
        const camFrame = camBuffer.frame;
        if (camFrame) {
          drawCameraOverlay(
            ctx,
            camFrame,
            camFrame.codedWidth,
            camFrame.codedHeight,
            width,
            height,
            cameraPosition,
            cameraSize,
          );
        }

        const frame = new VideoFrame(canvas, {
          timestamp: screenFrame.timestamp,
        });
        await writer.write(frame);
        frame.close();
        screenFrame.close();
      }
    } catch {
      /* track ended */
    } finally {
      screenReader.releaseLock();
      try {
        await writer.close();
      } catch {
        /* already closed */
      }
    }
  })();

  void camLoop;
  void mainLoop;

  return {
    stream: new MediaStream([generator]),
    stop: () => {
      stopped = true;
      if (camBuffer.frame) camBuffer.frame.close();
    },
  };
}

/** Fallback compositor when Breakout Box is unavailable. */
export function startCanvasCompositor(
  screenVideo: HTMLVideoElement,
  cameraVideo: HTMLVideoElement | null,
  width: number,
  height: number,
  frameRate: FrameRate,
  cameraPosition: CameraPosition,
  cameraSize: CameraSize,
): CompositorHandle {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  let stopped = false;
  let intervalId = 0;

  const draw = () => {
    if (stopped) return;
    if (screenVideo.readyState >= 2) {
      ctx.drawImage(screenVideo, 0, 0, width, height);
    }
    if (cameraVideo && cameraVideo.readyState >= 2) {
      drawCameraOverlay(
        ctx,
        cameraVideo,
        cameraVideo.videoWidth,
        cameraVideo.videoHeight,
        width,
        height,
        cameraPosition,
        cameraSize,
      );
    }
  };

  const tick = () => draw();
  intervalId = window.setInterval(tick, Math.max(16, Math.floor(1000 / frameRate)));

  const onVisibility = () => {
    if (!document.hidden) {
      void screenVideo.play().catch(() => undefined);
      void cameraVideo?.play().catch(() => undefined);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  draw();

  return {
    stream: canvas.captureStream(frameRate),
    stop: () => {
      stopped = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
