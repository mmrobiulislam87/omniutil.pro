"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Circle,
  Download,
  Film,
  Mic,
  Monitor,
  Music,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Square,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { NudgeButton, VideoTimeline } from "@/components/screen-recorder/VideoTimeline";
import { cn } from "@/lib/cn";
import { downloadBlob, formatBytes } from "@/lib/format";
import {
  CAMERA_POSITIONS,
  CAMERA_SIZES,
  CAPTURE_GUIDE,
  FRAME_RATES,
  formatRecordingTime,
  QUALITY_PRESETS,
  startScreenRecording,
  type CameraPosition,
  type CameraSize,
  type FrameRate,
  type QualityPreset,
  type RecordingSession,
} from "@/utils/screenRecorder";
import {
  requestScreenWakeLock,
} from "@/utils/recordingPip";
import { probeVideoDuration } from "@/utils/videoProbe";
import {
  EXPORT_QUALITIES,
  exportVideo,
  estimateExportDuration,
  SPEED_OPTIONS,
  type ExportQuality,
} from "@/utils/videoTrimmer";

type Phase = "idle" | "countdown" | "recording" | "preview" | "exporting";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ScreenRecorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [includeMic, setIncludeMic] = useState(true);
  const [includeCamera, setIncludeCamera] = useState(false);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [quality, setQuality] = useState<QualityPreset>("1080p");
  const [frameRate, setFrameRate] = useState<FrameRate>(30);
  const [micGain, setMicGain] = useState(1);
  const [systemGain, setSystemGain] = useState(0.85);
  const [cameraPosition, setCameraPosition] =
    useState<CameraPosition>("bottom-right");
  const [cameraSize, setCameraSize] = useState<CameraSize>("md");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(true);
  const [exportQuality, setExportQuality] = useState<ExportQuality>("balanced");
  const [exportSpeed, setExportSpeed] = useState(1);
  const [muteExport, setMuteExport] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportProgress, setExportProgress] = useState(0);
  const [durationReady, setDurationReady] = useState(false);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);

  const sessionRef = useRef<RecordingSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const wakeLockReleaseRef = useRef<(() => void) | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  const effectiveDuration =
    duration > 0 ? duration : recordedDurationSec;

  const revokeVideoUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockReleaseRef.current?.();
      revokeVideoUrl(videoUrl);
    };
  }, [videoUrl, revokeVideoUrl]);

  useEffect(() => {
    if (phase !== "preview" || !rawBlob) return;

    let cancelled = false;
    setDurationReady(false);

    probeVideoDuration(rawBlob)
      .then((d) => {
        if (cancelled) return;
        setDuration(d);
        setTrimStart(0);
        setTrimEnd(d);
        setDurationReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback =
          recordedDurationSec > 0 ? recordedDurationSec : effectiveDuration;
        if (fallback > 0) {
          setDuration(fallback);
          setTrimStart(0);
          setTrimEnd(fallback);
        }
        setDurationReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [phase, rawBlob, recordedDurationSec]);

  useEffect(() => {
    if (phase !== "recording") return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "Recording in progress. Leaving this page will stop the recording.";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording") return;

    const onKey = (e: KeyboardEvent) => {
      if (!sessionRef.current) return;
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void stopRecordingRef.current();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        const session = sessionRef.current;
        if (session.isPaused()) {
          session.resume();
          setIsPaused(false);
        } else {
          session.pause();
          setIsPaused(true);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const setBlobPreview = useCallback(
    (blob: Blob) => {
      revokeVideoUrl(videoUrl);
      const url = URL.createObjectURL(blob);
      setRawBlob(blob);
      setVideoUrl(url);
    },
    [videoUrl, revokeVideoUrl],
  );

  const cleanupRecordingExtras = useCallback(() => {
    wakeLockReleaseRef.current?.();
    wakeLockReleaseRef.current = null;
  }, []);

  const clearAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    cleanupRecordingExtras();
    sessionRef.current = null;
    revokeVideoUrl(videoUrl);
    setVideoUrl(null);
    setRawBlob(null);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setCurrentTime(0);
    setElapsedMs(0);
    setExportStatus("");
    setExportProgress(0);
    setIsPaused(false);
    setCountdown(null);
    setDurationReady(false);
    setRecordedDurationSec(0);
    setError(null);
    setPhase("idle");
  }, [videoUrl, revokeVideoUrl, cleanupRecordingExtras]);

  const recorderOptions = useCallback(
    () => ({
      includeMic,
      includeCamera,
      includeSystemAudio,
      quality,
      frameRate,
      micGain,
      systemGain,
      cameraPosition,
      cameraSize,
      onBeforeStart: async () => {
        setPhase("countdown");
        for (let i = 3; i >= 1; i--) {
          setCountdown(i);
          await sleep(1000);
        }
        setCountdown(null);
        setPhase("recording");
      },
    }),
    [
      includeMic,
      includeCamera,
      includeSystemAudio,
      quality,
      frameRate,
      micGain,
      systemGain,
      cameraPosition,
      cameraSize,
    ],
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const session = await startScreenRecording(recorderOptions());
      sessionRef.current = session;
      setIsPaused(false);
      setElapsedMs(0);

      const releaseWake = await requestScreenWakeLock();
      wakeLockReleaseRef.current = releaseWake;

      timerRef.current = setInterval(() => {
        if (!sessionRef.current) return;
        const ms = sessionRef.current.getElapsedMs();
        const paused = sessionRef.current.isPaused();
        setElapsedMs(ms);
        setIsPaused(paused);
      }, 100);
    } catch (err) {
      cleanupRecordingExtras();
      setCountdown(null);
      setPhase("idle");
      setError(
        err instanceof Error
          ? err.message
          : "Could not start screen recording. Allow screen share when prompted.",
      );
    }
  }, [recorderOptions, cleanupRecordingExtras]);

  const togglePause = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.isPaused()) {
      session.resume();
      setIsPaused(false);
    } else {
      session.pause();
      setIsPaused(true);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cleanupRecordingExtras();

    try {
      const recordedSec = session.getElapsedMs() / 1000;
      setRecordedDurationSec(recordedSec);
      const blob = await session.stop();
      sessionRef.current = null;
      setBlobPreview(blob);
      if (recordedSec > 0) {
        setDuration(recordedSec);
        setTrimStart(0);
        setTrimEnd(recordedSec);
      }
      setPhase("preview");
      setIsPaused(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recording.");
      setPhase("idle");
    }
  }, [setBlobPreview, cleanupRecordingExtras]);

  stopRecordingRef.current = stopRecording;

  const onPreviewLoaded = useCallback(() => {
    const video = previewRef.current;
    if (!video) return;
    const d = video.duration;
    if (Number.isFinite(d) && d > 0 && d !== Infinity) {
      setDuration(d);
      setTrimStart(0);
      setTrimEnd(d);
      setDurationReady(true);
    }
  }, []);

  const onTimeUpdate = useCallback(() => {
    const video = previewRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (loopSelection && video.currentTime >= trimEnd - 0.05) {
      video.currentTime = trimStart;
    }
  }, [loopSelection, trimEnd, trimStart]);

  const seek = useCallback((t: number) => {
    const video = previewRef.current;
    if (!video) return;
    video.currentTime = t;
    setCurrentTime(t);
  }, []);

  const togglePlay = useCallback(() => {
    const video = previewRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [trimStart, trimEnd]);

  const nudge = useCallback(
    (target: "start" | "end", delta: number) => {
      if (target === "start") {
        setTrimStart((s) => Math.max(0, Math.min(s + delta, trimEnd - 0.25)));
      } else {
        setTrimEnd((e) =>
          Math.min(duration, Math.max(e + delta, trimStart + 0.25)),
        );
      }
    },
    [duration, trimEnd, trimStart],
  );

  const runExport = useCallback(
    async (mode: "video" | "audio", download = true) => {
      if (!rawBlob) return;
      setPhase("exporting");
      setError(null);
      setExportProgress(0);
      setExportStatus("Preparing export…");

      try {
        const result = await exportVideo(
          rawBlob,
          {
            startSec: trimStart,
            endSec: trimEnd > 0 ? trimEnd : effectiveDuration,
            muteAudio: muteExport,
            speed: exportSpeed,
            quality: exportQuality,
            mode,
          },
          (message, ratio) => {
            setExportStatus(message);
            if (ratio != null) setExportProgress(ratio);
          },
        );

        const ext = mode === "audio" ? "webm" : "webm";
        const prefix = mode === "audio" ? "omniutil-audio" : "omniutil-export";
        if (download) {
          downloadBlob(result, `${prefix}-${Date.now()}.${ext}`);
          setExportStatus("Download started.");
        } else {
          setBlobPreview(result);
          setExportStatus("Applied to preview.");
        }
        setPhase("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed.");
        setPhase("preview");
      }
    },
    [
      rawBlob,
      trimStart,
      trimEnd,
      muteExport,
      exportSpeed,
      exportQuality,
      setBlobPreview,
    ],
  );

  const exportDuration = estimateExportDuration(
    trimStart,
    trimEnd || effectiveDuration,
    exportSpeed,
  );

  const editorReady = durationReady && effectiveDuration > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-medium text-red-300">
          <Video className="h-4 w-4" />
          Pro Studio · MediaRecorder + ffmpeg.wasm
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Up to 1440p @ 60fps with mic, system audio, and webcam PiP. Controls
          stay on this page only — nothing floats on screen during capture.
        </p>
      </div>

      {phase === "idle" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-100/90">
          <p className="mb-2 font-semibold text-amber-300">
            How to record other sites (YouTube, etc.)
          </p>
          <ul className="list-inside list-disc space-y-1 text-amber-100/80">
            {CAPTURE_GUIDE.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-5 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-6">
          <p className="text-sm text-gray-400">
            Configure your session, then share a screen, window, or tab. A short
            countdown starts before capture begins.
          </p>

          <div className="flex flex-wrap gap-3">
            <ToggleChip
              active={includeMic}
              onClick={() => setIncludeMic((v) => !v)}
              icon={Mic}
              label="Microphone"
            />
            <ToggleChip
              active={includeSystemAudio}
              onClick={() => setIncludeSystemAudio((v) => !v)}
              icon={Volume2}
              label="System audio"
            />
            <ToggleChip
              active={includeCamera}
              onClick={() => setIncludeCamera((v) => !v)}
              icon={Camera}
              label="Webcam PiP"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-gray-500">Quality</span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as QualityPreset)}
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-gray-200"
              >
                {QUALITY_PRESETS.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-gray-500">Frame rate</span>
              <select
                value={frameRate}
                onChange={(e) =>
                  setFrameRate(Number(e.target.value) as FrameRate)
                }
                className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-gray-200"
              >
                {FRAME_RATES.map((fps) => (
                  <option key={fps} value={fps}>
                    {fps} fps
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-300"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showAdvanced ? "Hide" : "Show"} advanced audio & camera
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-gray-800/80 bg-gray-900/30 p-4">
              <SliderField
                label="Mic volume"
                value={micGain}
                min={0}
                max={2}
                step={0.05}
                onChange={setMicGain}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <SliderField
                label="System audio"
                value={systemGain}
                min={0}
                max={2}
                step={0.05}
                onChange={setSystemGain}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              {includeCamera && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm">
                    <span className="text-gray-500">Camera position</span>
                    <select
                      value={cameraPosition}
                      onChange={(e) =>
                        setCameraPosition(e.target.value as CameraPosition)
                      }
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                    >
                      {CAMERA_POSITIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="text-gray-500">Camera size</span>
                    <select
                      value={cameraSize}
                      onChange={(e) =>
                        setCameraSize(e.target.value as CameraSize)
                      }
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                    >
                      {CAMERA_SIZES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={startRecording} className="gap-2">
              <Circle className="h-4 w-4 fill-current text-red-400" />
              Start recording
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Monitor className="h-3.5 w-3.5" />
              {quality} · {frameRate}fps · unlimited length
            </span>
          </div>
        </div>
      )}

      {(phase === "countdown" || countdown != null) && (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5">
          <span className="animate-pulse text-7xl font-black tabular-nums text-red-400">
            {countdown}
          </span>
        </div>
      )}

      {phase === "recording" && (
        <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-300">
              <span className="relative flex h-2.5 w-2.5">
                {!isPaused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    isPaused ? "bg-amber-500" : "bg-red-500",
                  )}
                />
              </span>
              {isPaused ? "PAUSED" : "REC"} ·{" "}
              {formatRecordingTime(elapsedMs, true)}
            </div>
            <span className="rounded border border-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-500">
              {quality} · {frameRate}fps
            </span>
          </div>

          <p className="text-xs text-gray-500">
            Switch tabs if you shared Entire Screen or another tab. Stop via{" "}
            <kbd className="rounded border border-gray-700 px-1 text-[10px]">
              Ctrl+Shift+S
            </kbd>{" "}
            or Chrome&apos;s &quot;Stop sharing&quot; bar.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={togglePause} className="gap-2">
              {isPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button onClick={stopRecording} className="gap-2">
              <Square className="h-4 w-4 fill-current" />
              Stop & edit
            </Button>
          </div>
        </div>
      )}

      {(phase === "preview" || phase === "exporting") && videoUrl && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-black">
            <video
              ref={previewRef}
              src={videoUrl}
              controls
              playsInline
              onLoadedMetadata={onPreviewLoaded}
              onDurationChange={onPreviewLoaded}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="max-h-[min(60vh,480px)] w-full"
            />
            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/35 transition hover:bg-black/45"
                aria-label="Play recording"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-600/40">
                  <Play className="h-8 w-8 fill-white text-white" />
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={togglePlay} disabled={phase === "exporting"}>
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            {rawBlob && (
              <p className="text-xs text-gray-500">
                {formatBytes(rawBlob.size)}
                {effectiveDuration > 0 &&
                  ` · ${formatRecordingTime(effectiveDuration * 1000)}`}
              </p>
            )}
          </div>

          {!editorReady && (
            <p className="text-xs text-gray-500">Loading editor…</p>
          )}

          {editorReady && (
            <>
              <div className="space-y-3 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <Scissors className="h-3.5 w-3.5" />
                    Timeline editor
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={togglePlay}
                      disabled={phase === "exporting"}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Preview
                    </Button>
                    <ToggleChip
                      active={loopSelection}
                      onClick={() => setLoopSelection((v) => !v)}
                      icon={RotateCcw}
                      label="Loop selection"
                      compact
                    />
                  </div>
                </div>

                <VideoTimeline
                  duration={effectiveDuration}
                  start={trimStart}
                  end={trimEnd || effectiveDuration}
                  currentTime={currentTime}
                  disabled={phase === "exporting"}
                  onStartChange={setTrimStart}
                  onEndChange={setTrimEnd}
                  onSeek={seek}
                />

                <div className="flex flex-wrap gap-1.5">
                  <span className="mr-1 self-center text-[10px] text-gray-600">
                    Start
                  </span>
                  <NudgeButton
                    label="-1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("start", -1)}
                  />
                  <NudgeButton
                    label="-0.1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("start", -0.1)}
                  />
                  <NudgeButton
                    label="+0.1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("start", 0.1)}
                  />
                  <NudgeButton
                    label="+1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("start", 1)}
                  />
                  <span className="mx-2 self-center text-gray-700">|</span>
                  <span className="mr-1 self-center text-[10px] text-gray-600">
                    End
                  </span>
                  <NudgeButton
                    label="-1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("end", -1)}
                  />
                  <NudgeButton
                    label="-0.1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("end", -0.1)}
                  />
                  <NudgeButton
                    label="+0.1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("end", 0.1)}
                  />
                  <NudgeButton
                    label="+1s"
                    disabled={phase === "exporting"}
                    onClick={() => nudge("end", 1)}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <Film className="h-3.5 w-3.5" />
                  Export settings
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1.5 text-sm">
                    <span className="text-gray-500">Quality</span>
                    <select
                      value={exportQuality}
                      disabled={phase === "exporting"}
                      onChange={(e) =>
                        setExportQuality(e.target.value as ExportQuality)
                      }
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                    >
                      {EXPORT_QUALITIES.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="text-gray-500">Speed</span>
                    <select
                      value={exportSpeed}
                      disabled={phase === "exporting"}
                      onChange={(e) =>
                        setExportSpeed(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                    >
                      {SPEED_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <ToggleChip
                      active={muteExport}
                      onClick={() => setMuteExport((v) => !v)}
                      icon={muteExport ? VolumeX : Volume2}
                      label="Mute audio"
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Output length:{" "}
                  <span className="font-mono text-gray-400">
                    {formatRecordingTime(exportDuration * 1000, true)}
                  </span>
                  {exportSpeed !== 1 && (
                    <span className="ml-1 text-amber-500/80">
                      ({exportSpeed}× speed)
                    </span>
                  )}
                </p>
              </div>
            </>
          )}

          {phase === "exporting" && (
            <div className="space-y-2 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{exportStatus}</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => runExport("video", true)}
              disabled={phase === "exporting" || !editorReady}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export video
            </Button>
            <Button
              variant="secondary"
              onClick={() => runExport("video", false)}
              disabled={phase === "exporting" || !editorReady}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Apply to preview
            </Button>
            <Button
              variant="secondary"
              onClick={() => runExport("audio", true)}
              disabled={phase === "exporting" || duration <= 0 || muteExport}
              className="gap-2"
            >
              <Music className="h-4 w-4" />
              Extract audio
            </Button>
            {rawBlob && (
              <Button
                variant="ghost"
                onClick={() =>
                  downloadBlob(rawBlob, `omniutil-raw-${Date.now()}.webm`)
                }
                disabled={phase === "exporting"}
              >
                <Download className="h-4 w-4" />
                Raw WebM
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={clearAll}
              disabled={phase === "exporting"}
            >
              <Trash2 className="h-4 w-4" />
              New recording
            </Button>
          </div>
        </div>
      )}

      {error && <ToolErrorBanner message={error} />}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  icon: Icon,
  label,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Mic;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border text-sm transition",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2",
        active
          ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
          : "border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700",
      )}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <div className="flex justify-between text-gray-500">
        <span>{label}</span>
        <span className="font-mono text-xs text-gray-400">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  );
}
