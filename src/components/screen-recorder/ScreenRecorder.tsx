"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Circle,
  Mic,
  Monitor,
  Pause,
  Play,
  Settings2,
  Square,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { ProStudioEditor } from "@/components/screen-recorder/ProStudioEditor";
import { cn } from "@/lib/cn";
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
  const [durationReady, setDurationReady] = useState(false);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);

  const sessionRef = useRef<RecordingSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        setDurationReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback =
          recordedDurationSec > 0 ? recordedDurationSec : effectiveDuration;
        if (fallback > 0) {
          setDuration(fallback);
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
    setElapsedMs(0);
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
      }
      setPhase("preview");
      setIsPaused(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recording.");
      setPhase("idle");
    }
  }, [setBlobPreview, cleanupRecordingExtras]);

  stopRecordingRef.current = stopRecording;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-medium text-red-300">
          <Video className="h-4 w-4" />
          Pro Studio Editor · Record + professional edit
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Up to 1440p @ 60fps with mic, system audio, and webcam PiP. After
          recording, split clips, export Shorts/Reels, clean audio, add your
          brand, and ship with Discord or email size presets — all in-browser.
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

      {(phase === "preview" || phase === "exporting") && videoUrl && rawBlob && (
        <ProStudioEditor
          videoUrl={videoUrl}
          rawBlob={rawBlob}
          duration={effectiveDuration}
          durationReady={durationReady && effectiveDuration > 0}
          exporting={phase === "exporting"}
          onExportingChange={(v) => setPhase(v ? "exporting" : "preview")}
          onError={setError}
          onApplyPreview={(blob) => {
            setBlobPreview(blob);
            setDurationReady(false);
            probeVideoDuration(blob)
              .then((d) => {
                setDuration(d);
                setDurationReady(true);
              })
              .catch(() => setDurationReady(true));
          }}
          onNewRecording={clearAll}
        />
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
