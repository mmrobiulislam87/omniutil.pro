import type { StudioExportConfig } from "@/utils/proStudioExport";
import type { WatermarkPosition } from "@/utils/watermarkCanvas";

type ProgressCallback = (message: string, ratio?: number) => void;

type OverlaySpec = {
  pngBytes: Uint8Array;
  position: WatermarkPosition;
  opacity: number;
  scale: number;
};

function pickRecorderMime(): string {
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

function bytesToImage(bytes: Uint8Array): Promise<HTMLImageElement> {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load overlay image"));
    };
    img.src = url;
  });
}

function outputSize(config: StudioExportConfig): { w: number; h: number } {
  if (config.aspectMode === "shorts") return { w: 720, h: 1280 };
  return { w: 1280, h: 720 };
}

function srcCropRect(
  vw: number,
  vh: number,
  crop: StudioExportConfig["crop"],
): { x: number; y: number; w: number; h: number } {
  const mode = crop ?? "none";
  if (mode === "tight") {
    const w = vw * 0.85;
    const h = vh * 0.85;
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
  }
  if (mode === "square") {
    const s = Math.min(vw, vh);
    return { x: (vw - s) / 2, y: (vh - s) / 2, w: s, h: s };
  }
  if (mode === "cinema") {
    const h = vw * (9 / 16);
    if (h <= vh) return { x: 0, y: (vh - h) / 2, w: vw, h };
    const w = vh * (16 / 9);
    return { x: (vw - w) / 2, y: 0, w, h: vh };
  }
  return { x: 0, y: 0, w: vw, h: vh };
}

function fadeAlpha(
  outTime: number,
  total: number,
  fadeIn: number,
  fadeOut: number,
): number {
  let a = 1;
  if (fadeIn > 0) a = Math.min(a, outTime / fadeIn);
  if (fadeOut > 0 && total > fadeOut) {
    const fadeStart = total - fadeOut;
    if (outTime > fadeStart) a = Math.min(a, (total - outTime) / fadeOut);
  }
  return Math.max(0, Math.min(1, a));
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  spec: OverlaySpec,
  cw: number,
  ch: number,
): void {
  const margin = 20;
  const ow = cw * spec.scale;
  const oh = (img.height / img.width) * ow;
  let x = margin;
  let y = margin;
  if (spec.position.includes("right")) x = cw - ow - margin;
  if (spec.position.includes("bottom")) y = ch - oh - margin;
  ctx.save();
  ctx.globalAlpha = spec.opacity;
  ctx.drawImage(img, x, y, ow, oh);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: StudioExportConfig,
  outW: number,
  outH: number,
  outTime: number,
  totalOut: number,
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const src = srcCropRect(vw, vh, config.crop);
  const rotation = config.rotation ?? 0;
  const flipH = !!config.flipH;
  const fadeIn = config.fadeIn ?? 0;
  const fadeOut = config.fadeOut ?? 0;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, outW, outH);

  const alpha = fadeAlpha(outTime, totalOut, fadeIn, fadeOut);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(outW / 2, outH / 2);
  if (flipH) ctx.scale(-1, 1);
  ctx.rotate((rotation * Math.PI) / 180);

  if (config.aspectMode === "shorts") {
    const bgScale = Math.max(outW / src.w, outH / src.h) * 1.15;
    const bgW = src.w * bgScale;
    const bgH = src.h * bgScale;
    ctx.filter = "blur(12px) brightness(0.45)";
    ctx.drawImage(video, src.x, src.y, src.w, src.h, -bgW / 2, -bgH / 2, bgW, bgH);
    ctx.filter = "none";
    const fgScale = Math.min(outW / src.w, outH / src.h);
    const fgW = src.w * fgScale;
    const fgH = src.h * fgScale;
    ctx.drawImage(video, src.x, src.y, src.w, src.h, -fgW / 2, -fgH / 2, fgW, fgH);
  } else {
    const scale = Math.min(outW / src.w, outH / src.h);
    const dw = src.w * scale;
    const dh = src.h * scale;
    ctx.drawImage(video, src.x, src.y, src.w, src.h, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
}

function segmentOutDuration(
  segments: { start: number; end: number }[],
  speed: number,
): number {
  const raw = segments.reduce((s, seg) => s + Math.max(0, seg.end - seg.start), 0);
  return raw / speed;
}

function waitSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = () => reject(new Error("Seek failed"));
    video.addEventListener("error", onErr, { once: true });
    video.onseeked = () => {
      video.removeEventListener("error", onErr);
      resolve();
    };
    video.currentTime = time;
  });
}

/**
 * Browser-native export when ffmpeg.wasm runs out of memory.
 * Applies transform, Shorts layout, fades, and image overlays via canvas.
 */
export async function exportStudioViaCanvas(
  blob: Blob,
  config: StudioExportConfig,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const segments = config.segments.filter((s) => s.end > s.start);
  if (segments.length === 0) throw new Error("No segments to export.");

  const speed = config.speed || 1;
  const totalOut = segmentOutDuration(segments, speed);
  const { w: outW, h: outH } = outputSize(config);

  onProgress?.("Rendering effects in browser…", 20);

  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.muted = false;
  video.playbackRate = speed;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not load video for export."));
  });

  const wmImg = config.watermark
    ? await bytesToImage(config.watermark.pngBytes)
    : null;
  const stImg = config.sticker
    ? await bytesToImage(config.sticker.pngBytes)
    : null;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const mimeType = pickRecorderMime();
  const canvasStream = canvas.captureStream(30);
  const videoCap = (
    video as HTMLVideoElement & { captureStream?: () => MediaStream }
  ).captureStream?.();
  const audioTrack = videoCap?.getAudioTracks()[0];
  if (audioTrack) canvasStream.addTrack(audioTrack);

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 2_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Browser recording failed"));
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
  });

  let outTime = 0;
  let raf = 0;
  let segIdx = 0;

  const outputTimeAt = (videoTime: number, index: number): number => {
    let t = 0;
    for (let i = 0; i < index; i++) {
      t += (segments[i].end - segments[i].start) / speed;
    }
    return t + Math.max(0, videoTime - segments[index].start) / speed;
  };

  const paint = () => {
    outTime = outputTimeAt(video.currentTime, segIdx);
    drawFrame(ctx, video, config, outW, outH, outTime, totalOut);
    if (wmImg && config.watermark) {
      drawOverlay(ctx, wmImg, config.watermark, outW, outH);
    }
    if (stImg && config.sticker) {
      drawOverlay(ctx, stImg, config.sticker, outW, outH);
    }
    const pct = totalOut > 0 ? Math.min(95, 25 + (outTime / totalOut) * 70) : 50;
    onProgress?.("Rendering effects in browser…", Math.round(pct));
    if (!video.paused && !video.ended) {
      raf = requestAnimationFrame(paint);
    }
  };

  recorder.start(100);

  try {
    for (let i = 0; i < segments.length; i++) {
      segIdx = i;
      const seg = segments[i];
      await waitSeek(video, seg.start);
      await new Promise<void>((resolve, reject) => {
        const checkEnd = () => {
          if (video.currentTime >= seg.end - 0.05) {
            video.pause();
            video.removeEventListener("timeupdate", checkEnd);
            cancelAnimationFrame(raf);
            resolve();
          }
        };
        video.addEventListener("timeupdate", checkEnd);
        video.play().catch(reject);
        raf = requestAnimationFrame(paint);
      });
    }
  } catch (playErr) {
    video.muted = true;
    try {
      for (let i = 0; i < segments.length; i++) {
        segIdx = i;
        const seg = segments[i];
        await waitSeek(video, seg.start);
        await new Promise<void>((resolve) => {
          const checkEnd = () => {
            if (video.currentTime >= seg.end - 0.05) {
              video.pause();
              video.removeEventListener("timeupdate", checkEnd);
              cancelAnimationFrame(raf);
              resolve();
            }
          };
          video.addEventListener("timeupdate", checkEnd);
          void video.play();
          raf = requestAnimationFrame(paint);
        });
      }
    } catch {
      recorder.stop();
      URL.revokeObjectURL(url);
      throw playErr;
    }
  }

  recorder.stop();
  const result = await recorded;
  URL.revokeObjectURL(url);
  onProgress?.("Done", 100);
  return result;
}
