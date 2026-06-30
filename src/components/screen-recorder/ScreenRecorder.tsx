"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Circle,
  Download,
  Mic,
  Monitor,
  Scissors,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolErrorBanner } from "@/components/ui/ToolStateWrapper";
import { cn } from "@/lib/cn";
import { downloadBlob, formatBytes } from "@/lib/format";
import {
  formatRecordingTime,
  startScreenRecording,
  type RecordingSession,
} from "@/utils/screenRecorder";
import { trimVideoBlob } from "@/utils/videoTrimmer";

type Phase = "idle" | "recording" | "preview" | "trimming";

export function ScreenRecorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [includeMic, setIncludeMic] = useState(true);
  const [includeCamera, setIncludeCamera] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimStatus, setTrimStatus] = useState("");
  const [trimProgress, setTrimProgress] = useState(0);

  const sessionRef = useRef<RecordingSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  const revokeVideoUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      revokeVideoUrl(videoUrl);
    };
  }, [videoUrl, revokeVideoUrl]);

  const clearAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sessionRef.current = null;
    revokeVideoUrl(videoUrl);
    setVideoUrl(null);
    setRawBlob(null);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setElapsedMs(0);
    setTrimStatus("");
    setTrimProgress(0);
    setError(null);
    setPhase("idle");
  }, [videoUrl, revokeVideoUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const session = await startScreenRecording({ includeMic, includeCamera });
      sessionRef.current = session;
      setPhase("recording");
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(session.getElapsedMs());
      }, 250);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start screen recording. Allow screen share when prompted.",
      );
    }
  }, [includeMic, includeCamera]);

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await session.stop();
      sessionRef.current = null;
      revokeVideoUrl(videoUrl);
      const url = URL.createObjectURL(blob);
      setRawBlob(blob);
      setVideoUrl(url);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recording.");
      setPhase("idle");
    }
  }, [videoUrl, revokeVideoUrl]);

  const onPreviewLoaded = useCallback(() => {
    const video = previewRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const d = video.duration;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(d);
  }, []);

  const downloadRaw = useCallback(() => {
    if (!rawBlob) return;
    downloadBlob(rawBlob, `omniutil-recording-${Date.now()}.webm`);
  }, [rawBlob]);

  const exportTrimmed = useCallback(async () => {
    if (!rawBlob) return;
    setPhase("trimming");
    setError(null);
    setTrimProgress(0);
    setTrimStatus("Preparing…");

    try {
      const trimmed = await trimVideoBlob(
        rawBlob,
        trimStart,
        trimEnd,
        (message, ratio) => {
          setTrimStatus(message);
          if (ratio != null) setTrimProgress(ratio);
        },
      );
      downloadBlob(trimmed, `omniutil-trimmed-${Date.now()}.webm`);
      setTrimStatus("Trimmed video downloaded.");
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trim failed.");
      setPhase("preview");
    }
  }, [rawBlob, trimStart, trimEnd]);

  const formatTimeInput = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${String(s).padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-medium text-red-300">
          <Video className="h-4 w-4" />
          MediaRecorder · ffmpeg.wasm trim
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Record your screen in up to 1080p with optional mic and webcam
          overlay. No extension, no watermark, no uploads — trim and download
          entirely in your browser. First trim loads ffmpeg (~30 MB) from CDN.
        </p>
      </div>

      {phase === "idle" && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-6">
          <p className="text-sm text-gray-400">
            Choose sources, then start recording. Your browser will ask which
            screen, window, or tab to share.
          </p>

          <div className="flex flex-wrap gap-3">
            <ToggleChip
              active={includeMic}
              onClick={() => setIncludeMic((v) => !v)}
              icon={Mic}
              label="Microphone"
            />
            <ToggleChip
              active={includeCamera}
              onClick={() => setIncludeCamera((v) => !v)}
              icon={Camera}
              label="Webcam overlay"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={startRecording} className="gap-2">
              <Circle className="h-4 w-4 fill-current text-red-400" />
              Start recording
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Monitor className="h-3.5 w-3.5" />
              Screen + system audio when supported
            </span>
          </div>
        </div>
      )}

      {phase === "recording" && (
        <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            REC · {formatRecordingTime(elapsedMs)}
          </div>
          <p className="text-xs text-gray-500">
            Click Stop when finished, or end the screen share from your browser
            UI.
          </p>
          <Button variant="secondary" onClick={stopRecording} className="gap-2">
            <Square className="h-4 w-4 fill-current" />
            Stop recording
          </Button>
        </div>
      )}

      {(phase === "preview" || phase === "trimming") && videoUrl && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-800 bg-black">
            <video
              ref={previewRef}
              src={videoUrl}
              controls
              playsInline
              onLoadedMetadata={onPreviewLoaded}
              className="max-h-[min(70vh,520px)] w-full"
            />
          </div>

          {rawBlob && (
            <p className="text-xs text-gray-500">
              Original size: {formatBytes(rawBlob.size)}
              {duration > 0 && ` · ${formatRecordingTime(duration * 1000)}`}
            </p>
          )}

          {duration > 0 && (
            <div className="space-y-4 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Scissors className="h-3.5 w-3.5" />
                Trim segment
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="text-gray-400">Start</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={trimStart}
                    disabled={phase === "trimming"}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTrimStart(Math.min(v, trimEnd - 0.1));
                    }}
                    className="w-full accent-blue-500"
                  />
                  <span className="font-mono text-xs text-gray-500">
                    {formatTimeInput(trimStart)}
                  </span>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-gray-400">End</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    disabled={phase === "trimming"}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTrimEnd(Math.max(v, trimStart + 0.1));
                    }}
                    className="w-full accent-blue-500"
                  />
                  <span className="font-mono text-xs text-gray-500">
                    {formatTimeInput(trimEnd)}
                  </span>
                </label>
              </div>

              <p className="text-xs text-gray-500">
                Selection: {formatTimeInput(trimEnd - trimStart)} (
                {formatTimeInput(trimStart)} → {formatTimeInput(trimEnd)})
              </p>
            </div>
          )}

          {phase === "trimming" && (
            <div className="space-y-2 rounded-xl border border-gray-800 bg-[#0B0F19]/50 p-4">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{trimStatus}</span>
                <span>{trimProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${trimProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadRaw} disabled={phase === "trimming"}>
              <Download className="h-4 w-4" />
              Download full WebM
            </Button>
            <Button
              variant="secondary"
              onClick={exportTrimmed}
              disabled={phase === "trimming" || duration <= 0}
            >
              <Scissors className="h-4 w-4" />
              Export trimmed
            </Button>
            <Button
              variant="ghost"
              onClick={clearAll}
              disabled={phase === "trimming"}
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
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Mic;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
        active
          ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
          : "border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-700",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
