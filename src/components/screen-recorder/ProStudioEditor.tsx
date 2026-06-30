"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Download,
  ImagePlus,
  Monitor,
  Scissors,
  Pause,
  Play,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentTimeline } from "@/components/screen-recorder/SegmentTimeline";
import { cn } from "@/lib/cn";
import { downloadBlob, formatBytes } from "@/lib/format";
import { formatRecordingTime } from "@/utils/screenRecorder";
import {
  createInitialSegments,
  deleteSegment,
  findSegmentAt,
  segmentsDuration,
  splitSegmentAt,
  type TimelineSegment,
} from "@/utils/editorSegments";
import {
  EXPORT_PRESETS,
  renderStudioExport,
  type AspectMode,
  type ExportPreset,
} from "@/utils/proStudioExport";
import { resetFfmpegLoader } from "@/utils/ffmpegLoader";
import { SPEED_OPTIONS } from "@/utils/videoTrimmer";
import {
  fileToBytes,
  renderTextWatermarkPng,
  type WatermarkPosition,
} from "@/utils/watermarkCanvas";

type EditorTab = "cut" | "social" | "audio" | "brand" | "export";

type ProStudioEditorProps = {
  videoUrl: string;
  rawBlob: Blob;
  duration: number;
  durationReady: boolean;
  exporting: boolean;
  onExportingChange: (v: boolean) => void;
  onError: (msg: string | null) => void;
  onApplyPreview: (blob: Blob) => void;
  onNewRecording: () => void;
};

const TABS: { id: EditorTab; label: string; icon: typeof Scissors }[] = [
  { id: "cut", label: "Cut", icon: Scissors },
  { id: "social", label: "Social", icon: Smartphone },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "brand", label: "Brand", icon: ImagePlus },
  { id: "export", label: "Export", icon: Download },
];

function clampToSegments(segments: TimelineSegment[], time: number): number {
  const hit = findSegmentAt(segments, time);
  if (hit) return time;
  const next = segments.find((s) => s.start > time);
  if (next) return next.start;
  const last = segments[segments.length - 1];
  return last ? last.end : time;
}

export function ProStudioEditor({
  videoUrl,
  rawBlob,
  duration,
  durationReady,
  exporting,
  onExportingChange,
  onError,
  onApplyPreview,
  onNewRecording,
}: ProStudioEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<EditorTab>("cut");
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [aspectMode, setAspectMode] = useState<AspectMode>("landscape");
  const [cleanAudio, setCleanAudio] = useState(false);
  const [voiceBoost, setVoiceBoost] = useState(false);
  const [exportSpeed, setExportSpeed] = useState(1);
  const [exportPreset, setExportPreset] = useState<ExportPreset>("balanced");

  const [watermarkMode, setWatermarkMode] = useState<"none" | "text" | "logo">(
    "none",
  );
  const [watermarkText, setWatermarkText] = useState("OmniUtil.pro");
  const [watermarkPosition, setWatermarkPosition] =
    useState<WatermarkPosition>("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.85);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [exportStatus, setExportStatus] = useState("");
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    if (!durationReady || duration <= 0) return;
    const initial = createInitialSegments(duration);
    setSegments(initial);
    setSelectedId(initial[0]?.id ?? null);
    setCurrentTime(0);
  }, [duration, durationReady]);

  const seek = useCallback((t: number) => {
    const video = videoRef.current;
    const clamped = Math.max(0, Math.min(duration, t));
    if (video) video.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    const t = video.currentTime;
    setCurrentTime(t);

    if (!isPlaying) return;

    const inSeg = findSegmentAt(segments, t);
    if (!inSeg) {
      const next = segments.find((s) => s.start > t);
      if (next) {
        video.currentTime = next.start;
      } else {
        video.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (t >= inSeg.end - 0.04) {
      const idx = segments.indexOf(inSeg);
      const nextSeg = segments[idx + 1];
      if (nextSeg) {
        video.currentTime = nextSeg.start;
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [isPlaying, segments]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    if (video.paused) {
      const start = clampToSegments(segments, currentTime);
      video.currentTime = start;
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [currentTime, segments]);

  const handleSplit = useCallback(() => {
    setSegments((prev) => {
      const next = splitSegmentAt(prev, currentTime);
      if (next === prev) return prev;
      const newSeg = next.find(
        (s) => s.start <= currentTime && s.end >= currentTime,
      );
      if (newSeg) setSelectedId(newSeg.id);
      return next;
    });
  }, [currentTime]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    setSegments((prev) => {
      const next = deleteSegment(prev, selectedId);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }, [selectedId]);

  const buildWatermark = useCallback(async () => {
    if (watermarkMode === "none") return undefined;
    if (watermarkMode === "logo" && logoFile) {
      return {
        pngBytes: await fileToBytes(logoFile),
        position: watermarkPosition,
        opacity: watermarkOpacity,
        scale: 0.18,
      };
    }
    if (watermarkMode === "text" && watermarkText.trim()) {
      return {
        pngBytes: await renderTextWatermarkPng(
          watermarkText.trim(),
          watermarkOpacity,
        ),
        position: watermarkPosition,
        opacity: watermarkOpacity,
        scale: 0.22,
      };
    }
    return undefined;
  }, [logoFile, watermarkMode, watermarkOpacity, watermarkPosition, watermarkText]);

  const runExport = useCallback(
    async (download: boolean) => {
      if (!rawBlob || segments.length === 0) return;
      onExportingChange(true);
      onError(null);
      setExportProgress(0);
      setExportStatus("Initializing ProStudio export…");

      try {
        const watermark = await buildWatermark();
        const result = await renderStudioExport(
          rawBlob,
          {
            segments: segments.map((s) => ({ start: s.start, end: s.end })),
            aspectMode,
            cleanAudio,
            voiceBoost,
            speed: exportSpeed,
            preset: exportPreset,
            watermark,
          },
          (message, ratio) => {
            setExportStatus(message);
            if (ratio != null) setExportProgress(ratio);
          },
        );

        if (download) {
          const suffix =
            aspectMode === "shorts" ? "shorts" : exportPreset;
          downloadBlob(result, `omniutil-${suffix}-${Date.now()}.webm`);
          setExportStatus("Download started.");
        } else {
          onApplyPreview(result);
          setExportStatus("Applied to preview.");
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Export failed. Try Balanced preset or download raw WebM.";
        onError(message);
        resetFfmpegLoader();
      } finally {
        onExportingChange(false);
      }
    },
    [
      rawBlob,
      segments,
      aspectMode,
      cleanAudio,
      voiceBoost,
      exportSpeed,
      exportPreset,
      buildWatermark,
      onApplyPreview,
      onError,
      onExportingChange,
    ],
  );

  const keptDuration = segmentsDuration(segments);
  const outputDuration = keptDuration / exportSpeed;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-800/90 bg-[#070a12] shadow-2xl shadow-black/40">
      {/* Studio chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 bg-[#0a0e18] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-900/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-100">ProStudio Editor</p>
            <p className="text-[11px] text-gray-500">
              {formatBytes(rawBlob.size)}
              {duration > 0 && ` · ${formatRecordingTime(duration * 1000)}`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewRecording}
          disabled={exporting}
          className="text-gray-400"
        >
          <Trash2 className="h-4 w-4" />
          New recording
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* Preview + transport */}
        <div className="border-b border-gray-800/60 lg:border-b-0 lg:border-r">
          <div
            className={cn(
              "relative flex items-center justify-center bg-black",
              aspectMode === "shorts" ? "min-h-[420px]" : "min-h-[280px]",
            )}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className={cn(
                "max-h-[min(52vh,520px)] w-full object-contain",
                aspectMode === "shorts" && "max-w-[min(100%,280px)]",
              )}
            />
            {aspectMode === "shorts" && (
              <div
                className="pointer-events-none absolute inset-0 mx-auto max-w-[280px] rounded-lg ring-2 ring-violet-500/50"
                aria-hidden
              />
            )}
            {!isPlaying && durationReady && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
                aria-label="Play"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-xl">
                  <Play className="ml-0.5 h-7 w-7 fill-current" />
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-800/60 px-4 py-3">
            <Button
              size="sm"
              onClick={togglePlay}
              disabled={!durationReady || exporting}
              className="h-9 w-9 rounded-full p-0"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <span className="font-mono text-xs text-gray-400">
              {formatRecordingTime(currentTime * 1000, true)}
              <span className="text-gray-600"> / </span>
              {formatRecordingTime(duration * 1000, true)}
            </span>
            {aspectMode === "shorts" && (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                9:16 preview frame
              </span>
            )}
          </div>

          {durationReady && (
            <div className="border-t border-gray-800/60 px-4 py-4">
              <SegmentTimeline
                duration={duration}
                segments={segments}
                selectedId={selectedId}
                currentTime={currentTime}
                disabled={exporting}
                onSelect={setSelectedId}
                onSeek={seek}
                onSplit={handleSplit}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>

        {/* Tool panel */}
        <div className="flex flex-col">
          <div className="flex border-b border-gray-800/60">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition",
                  tab === id
                    ? "border-b-2 border-blue-500 text-blue-300"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 p-4 text-sm">
            {tab === "cut" && (
              <div className="space-y-3 text-gray-400">
                <p className="text-xs leading-relaxed">
                  Move the playhead and tap{" "}
                  <span className="text-gray-200">Split</span> to cut clips.
                  Delete unwanted segments — only green clips export.
                </p>
                <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Kept duration
                  </p>
                  <p className="mt-1 font-mono text-lg text-emerald-400">
                    {formatRecordingTime(keptDuration * 1000, true)}
                  </p>
                </div>
              </div>
            )}

            {tab === "social" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Convert landscape recordings to vertical Shorts / Reels with a
                  blurred background fill.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <AspectCard
                    active={aspectMode === "landscape"}
                    onClick={() => setAspectMode("landscape")}
                    icon={Monitor}
                    label="16:9"
                    hint="YouTube, desktop"
                  />
                  <AspectCard
                    active={aspectMode === "shorts"}
                    onClick={() => setAspectMode("shorts")}
                    icon={Smartphone}
                    label="9:16"
                    hint="Shorts, Reels, TikTok"
                  />
                </div>
              </div>
            )}

            {tab === "audio" && (
              <div className="space-y-3">
                <ToggleRow
                  label="Noise clean"
                  hint="High-pass + low-pass + FFT denoise"
                  active={cleanAudio}
                  onClick={() => setCleanAudio((v) => !v)}
                />
                <ToggleRow
                  label="Voice boost"
                  hint="+45% volume on speech"
                  active={voiceBoost}
                  onClick={() => setVoiceBoost((v) => !v)}
                />
              </div>
            )}

            {tab === "brand" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["none", "Off"],
                      ["text", "Text"],
                      ["logo", "Logo"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWatermarkMode(mode)}
                      className={cn(
                        "rounded-lg border py-2 text-xs transition",
                        watermarkMode === mode
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                          : "border-gray-800 text-gray-500 hover:border-gray-700",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {watermarkMode === "text" && (
                  <label className="block space-y-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Type className="h-3.5 w-3.5" />
                      Watermark text
                    </span>
                    <input
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                    />
                  </label>
                )}

                {watermarkMode === "logo" && (
                  <div className="space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        setLogoFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                      {logoFile ? logoFile.name : "Upload logo"}
                    </Button>
                  </div>
                )}

                {watermarkMode !== "none" && (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-xs text-gray-500">Position</span>
                      <select
                        value={watermarkPosition}
                        onChange={(e) =>
                          setWatermarkPosition(
                            e.target.value as WatermarkPosition,
                          )
                        }
                        className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                      >
                        <option value="top-left">Top left</option>
                        <option value="top-right">Top right</option>
                        <option value="bottom-left">Bottom left</option>
                        <option value="bottom-right">Bottom right</option>
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs text-gray-500">
                        Opacity {Math.round(watermarkOpacity * 100)}%
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={watermarkOpacity}
                        onChange={(e) =>
                          setWatermarkOpacity(Number(e.target.value))
                        }
                        className="w-full accent-blue-500"
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            {tab === "export" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {EXPORT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setExportPreset(p.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                        exportPreset === p.id
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-gray-800 hover:border-gray-700",
                      )}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span>
                        <span className="block text-sm font-medium text-gray-200">
                          {p.label}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {p.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs text-gray-500">Playback speed</span>
                  <select
                    value={exportSpeed}
                    onChange={(e) => setExportSpeed(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                  >
                    {SPEED_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="text-[11px] text-gray-500">
                  Output length{" "}
                  <span className="font-mono text-gray-400">
                    {formatRecordingTime(outputDuration * 1000, true)}
                  </span>
                  {exportSpeed !== 1 && (
                    <span className="text-amber-500/80"> ({exportSpeed}×)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-gray-800/60 p-4">
            {exporting && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>{exportStatus}</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500 transition-all"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              className="w-full gap-2"
              disabled={!durationReady || exporting || segments.length === 0}
              onClick={() => void runExport(true)}
            >
              <Download className="h-4 w-4" />
              Export video
            </Button>
            <Button
              variant="secondary"
              className="w-full gap-2"
              disabled={!durationReady || exporting || segments.length === 0}
              onClick={() => void runExport(false)}
            >
              <Zap className="h-4 w-4" />
              Apply to preview
            </Button>
          </div>
        </div>
      </div>

      {!durationReady && (
        <p className="border-t border-gray-800/60 px-4 py-3 text-center text-xs text-gray-500">
          Loading ProStudio engine…
        </p>
      )}
    </div>
  );
}

function AspectCard({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Monitor;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition",
        active
          ? "border-violet-500/50 bg-violet-500/10"
          : "border-gray-800 hover:border-gray-700",
      )}
    >
      <Icon
        className={cn(
          "mb-2 h-5 w-5",
          active ? "text-violet-300" : "text-gray-500",
        )}
      />
      <span className="block text-sm font-medium text-gray-200">{label}</span>
      <span className="text-[10px] text-gray-500">{hint}</span>
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition",
        active
          ? "border-blue-500/50 bg-blue-500/10"
          : "border-gray-800 hover:border-gray-700",
      )}
    >
      <span>
        <span className="block text-sm text-gray-200">{label}</span>
        <span className="text-[11px] text-gray-500">{hint}</span>
      </span>
      <span
        className={cn(
          "h-5 w-9 rounded-full transition",
          active ? "bg-blue-500" : "bg-gray-700",
        )}
      >
        <span
          className={cn(
            "mt-0.5 block h-4 w-4 rounded-full bg-white transition",
            active ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
