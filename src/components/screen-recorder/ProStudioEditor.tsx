"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Crop,
  Download,
  ImagePlus,
  Monitor,
  Scissors,
  Pause,
  Play,
  RotateCw,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  Zap,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorToolbar } from "@/components/screen-recorder/EditorToolbar";
import { InteractiveOverlay } from "@/components/screen-recorder/InteractiveOverlay";
import { PlayerProgressBar } from "@/components/screen-recorder/PlayerProgressBar";
import { SegmentTimeline } from "@/components/screen-recorder/SegmentTimeline";
import { cn } from "@/lib/cn";
import { downloadBlob, formatBytes } from "@/lib/format";
import { formatRecordingTime } from "@/utils/screenRecorder";
import { useSegmentHistory } from "@/hooks/useSegmentHistory";
import {
  canMergeWithNext,
  createInitialSegments,
  deleteSegment,
  findSegmentAt,
  mergeWithNext,
  segmentsDuration,
  splitSegmentAt,
  trimSegmentEnd,
  trimSegmentStart,
  type TimelineSegment,
} from "@/utils/editorSegments";
import {
  EXPORT_PRESETS,
  renderStudioExport,
  type AspectMode,
  type CropMode,
  type ExportMode,
  type ExportPreset,
  type VideoRotation,
} from "@/utils/proStudioExport";
import { resetFfmpegLoader } from "@/utils/ffmpegLoader";
import { getPreviewTransformStyle } from "@/utils/studioFilters";
import {
  DEFAULT_OVERLAY_PLACEMENT,
  type OverlayPlacement,
} from "@/utils/overlayPlacement";
import { SPEED_OPTIONS } from "@/utils/videoTrimmer";
import {
  fileToBytes,
  renderTextWatermarkPng,
  type WatermarkPosition,
} from "@/utils/watermarkCanvas";

type EditorTab =
  | "cut"
  | "transform"
  | "effects"
  | "social"
  | "audio"
  | "brand"
  | "export";

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
  { id: "transform", label: "Transform", icon: Crop },
  { id: "effects", label: "Effects", icon: Wand2 },
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
  const previewRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<EditorTab>("cut");
  const [activeTrack, setActiveTrack] = useState<"video" | "audio">("video");
  const [audioDetached, setAudioDetached] = useState(false);

  const videoHistory = useSegmentHistory();
  const audioHistory = useSegmentHistory();

  const trackHistory = activeTrack === "video" ? videoHistory : audioHistory;
  const segments = trackHistory.segments;
  const selectedId = trackHistory.selectedId;
  const setSelectedId = trackHistory.setSelectedId;
  const applyTrack = trackHistory.apply;
  const beginGesture = trackHistory.beginGesture;
  const endGesture = trackHistory.endGesture;

  const canUndo = audioDetached ? trackHistory.canUndo : videoHistory.canUndo;
  const canRedo = audioDetached ? trackHistory.canRedo : videoHistory.canRedo;
  const undo = audioDetached ? trackHistory.undo : videoHistory.undo;
  const redo = audioDetached ? trackHistory.redo : videoHistory.redo;

  const apply = useCallback(
    (
      next: TimelineSegment[],
      nextSelected?: string | null,
      options?: { record?: boolean },
    ) => {
      if (audioDetached) {
        applyTrack(next, nextSelected, options);
      } else {
        videoHistory.apply(next, nextSelected, options);
        audioHistory.apply(next, nextSelected, { record: false });
      }
    },
    [audioDetached, applyTrack, videoHistory, audioHistory],
  );

  const resetTimelines = useCallback(
    (initial: TimelineSegment[]) => {
      videoHistory.reset(initial);
      audioHistory.reset(initial);
    },
    [videoHistory, audioHistory],
  );

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);

  const [aspectMode, setAspectMode] = useState<AspectMode>("landscape");
  const [rotation, setRotation] = useState<VideoRotation>(0);
  const [crop, setCrop] = useState<CropMode>("none");
  const [flipH, setFlipH] = useState(false);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
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

  const [stickerFile, setStickerFile] = useState<File | null>(null);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(
    null,
  );
  const [stickerPlacement, setStickerPlacement] = useState<OverlayPlacement>(
    DEFAULT_OVERLAY_PLACEMENT,
  );

  const [exportStatus, setExportStatus] = useState("");
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    if (!durationReady || duration <= 0) return;
    resetTimelines(createInitialSegments(duration));
    setCurrentTime(0);
    setActiveTrack("video");
    setAudioDetached(false);
  }, [duration, durationReady, resetTimelines]);

  useEffect(() => {
    if (!stickerFile) {
      setStickerPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(stickerFile);
    setStickerPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [stickerFile]);

  const seek = useCallback((t: number) => {
    const video = videoRef.current;
    const clamped = Math.max(0, Math.min(duration, t));
    if (video) video.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const playbackSegments = videoHistory.segments;
    if (!video || playbackSegments.length === 0) return;

    const t = video.currentTime;
    setCurrentTime(t);

    if (!isPlaying) return;

    const inSeg = findSegmentAt(playbackSegments, t);
    if (!inSeg) {
      const next = playbackSegments.find((s) => s.start > t);
      if (next) {
        video.currentTime = next.start;
      } else {
        video.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (t >= inSeg.end - 0.04) {
      const idx = playbackSegments.indexOf(inSeg);
      const nextSeg = playbackSegments[idx + 1];
      if (nextSeg) {
        video.currentTime = nextSeg.start;
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [isPlaying, videoHistory.segments]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    const playbackSegments = videoHistory.segments;
    if (!video || playbackSegments.length === 0) return;

    if (video.paused) {
      const start = clampToSegments(playbackSegments, currentTime);
      video.currentTime = start;
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [currentTime, videoHistory.segments]);

  const selected = segments.find((s) => s.id === selectedId);
  const canSplit =
    !!selected &&
    currentTime > selected.start + 0.25 &&
    currentTime < selected.end - 0.25;
  const canDelete = segments.length > 1 && !!selectedId;
  const canMerge = !!selectedId && canMergeWithNext(segments, selectedId);

  const handleSplit = useCallback(() => {
    const next = splitSegmentAt(segments, currentTime);
    if (next === segments) return;
    const newSeg = next.find(
      (s) => s.start <= currentTime && s.end >= currentTime,
    );
    apply(next, newSeg?.id ?? selectedId);
  }, [segments, currentTime, selectedId, apply]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const next = deleteSegment(segments, selectedId);
    if (next === segments) return;
    apply(next, next[0]?.id ?? null);
  }, [segments, selectedId, apply]);

  const handleMerge = useCallback(() => {
    if (!selectedId) return;
    const next = mergeWithNext(segments, selectedId);
    if (next === segments) return;
    apply(next, selectedId);
  }, [segments, selectedId, apply]);

  const commitTrim = useCallback(() => {
    endGesture();
  }, [endGesture]);

  const handleSkip = useCallback(
    (delta: number) => {
      if (delta === -Infinity) {
        const seg = selected ?? segments[0];
        if (seg) seek(seg.start);
        return;
      }
      seek(Math.max(0, Math.min(duration, currentTime + delta)));
    },
    [currentTime, duration, seek, selected, segments],
  );

  const handleSplitRef = useRef(handleSplit);
  const handleDeleteRef = useRef(handleDelete);
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  const togglePlayRef = useRef(togglePlay);
  handleSplitRef.current = handleSplit;
  handleDeleteRef.current = handleDelete;
  undoRef.current = undo;
  redoRef.current = redo;
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    if (exporting) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayRef.current();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
        return;
      }
      if (
        (e.ctrlKey && e.key.toLowerCase() === "y") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redoRef.current();
        return;
      }
      if (e.key.toLowerCase() === "s" && !e.ctrlKey) {
        e.preventDefault();
        handleSplitRef.current();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteRef.current();
        return;
      }
      if (e.key.toLowerCase() === "m" && !e.ctrlKey) {
        e.preventDefault();
        handleMerge();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSkip(e.shiftKey ? -1 : -0.1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSkip(e.shiftKey ? 1 : 0.1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exporting, handleMerge, handleSkip]);

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

  const buildSticker = useCallback(async () => {
    if (!stickerFile) return undefined;
    return {
      pngBytes: await fileToBytes(stickerFile),
      x: stickerPlacement.x,
      y: stickerPlacement.y,
      scale: stickerPlacement.scale,
      rotation: stickerPlacement.rotation,
      opacity: stickerPlacement.opacity,
    };
  }, [stickerFile, stickerPlacement]);

  const runExport = useCallback(
    async (download: boolean, exportMode: ExportMode = "video") => {
      if (!rawBlob || videoHistory.segments.length === 0) return;
      onExportingChange(true);
      onError(null);
      setExportProgress(0);
      setExportStatus(
        exportMode === "audio"
          ? "Extracting audio…"
          : "Initializing ProStudio export…",
      );

      try {
        const [watermark, sticker] = await Promise.all([
          buildWatermark(),
          buildSticker(),
        ]);
        const result = await renderStudioExport(
          rawBlob,
          {
            segments: videoHistory.segments.map((s) => ({
              start: s.start,
              end: s.end,
            })),
            audioSegments: audioDetached
              ? audioHistory.segments.map((s) => ({
                  start: s.start,
                  end: s.end,
                }))
              : undefined,
            aspectMode,
            cleanAudio,
            voiceBoost,
            speed: exportSpeed,
            preset: exportPreset,
            exportMode,
            rotation,
            crop,
            flipH,
            fadeIn,
            fadeOut,
            watermark,
            sticker,
          },
          (message, ratio) => {
            setExportStatus(message);
            if (ratio != null) setExportProgress(ratio);
          },
        );

        if (download) {
          const suffix =
            exportMode === "audio"
              ? "audio"
              : aspectMode === "shorts"
                ? "shorts"
                : exportPreset;
          downloadBlob(result, `omniutil-${suffix}-${Date.now()}.webm`);
          setExportStatus(
            exportMode === "audio" ? "Audio download started." : "Download started.",
          );
        } else {
          if (exportMode === "audio") {
            onError("Audio extract is download-only. Use Export audio.");
            return;
          }
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
      videoHistory.segments,
      audioDetached,
      audioHistory.segments,
      aspectMode,
      rotation,
      crop,
      flipH,
      fadeIn,
      fadeOut,
      cleanAudio,
      voiceBoost,
      exportSpeed,
      exportPreset,
      buildWatermark,
      buildSticker,
      onApplyPreview,
      onError,
      onExportingChange,
    ],
  );

  const keptDuration = segmentsDuration(videoHistory.segments);
  const outputDuration = keptDuration / exportSpeed;
  const previewStyle = getPreviewTransformStyle(rotation, crop, flipH);

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
            ref={previewRef}
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
              style={previewStyle}
              className={cn(
                "max-h-[min(52vh,520px)] w-full object-contain transition-transform duration-300",
                aspectMode === "shorts" && "max-w-[min(100%,280px)]",
              )}
            />
            {stickerPreviewUrl && (
              <InteractiveOverlay
                imageUrl={stickerPreviewUrl}
                placement={stickerPlacement}
                disabled={exporting}
                containerRef={previewRef}
                onChange={setStickerPlacement}
              />
            )}
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

          <PlayerProgressBar
            duration={duration}
            currentTime={currentTime}
            disabled={!durationReady || exporting}
            onSeek={seek}
          />

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
            <div className="border-t border-gray-800/60">
              <EditorToolbar
                disabled={exporting}
                canUndo={canUndo}
                canRedo={canRedo}
                canSplit={canSplit}
                canDelete={canDelete}
                canMerge={canMerge}
                zoom={timelineZoom}
                onUndo={undo}
                onRedo={redo}
                onSplit={handleSplit}
                onDelete={handleDelete}
                onMerge={handleMerge}
                onSkip={handleSkip}
                onZoomChange={setTimelineZoom}
              />
              <div className="space-y-3 px-4 py-4">
                <SegmentTimeline
                  duration={duration}
                  segments={videoHistory.segments}
                  selectedId={
                    activeTrack === "video" ? selectedId : null
                  }
                  currentTime={currentTime}
                  zoom={timelineZoom}
                  disabled={exporting}
                  label="Video"
                  variant="video"
                  onSelect={(id) => {
                    setActiveTrack("video");
                    videoHistory.setSelectedId(id);
                  }}
                  onSeek={seek}
                  onTrimStart={(id, time) => {
                    setActiveTrack("video");
                    const next = trimSegmentStart(
                      videoHistory.segments,
                      id,
                      time,
                    );
                    if (next !== videoHistory.segments) {
                      apply(next, id, { record: false });
                    }
                  }}
                  onTrimEnd={(id, time) => {
                    setActiveTrack("video");
                    const next = trimSegmentEnd(
                      videoHistory.segments,
                      id,
                      time,
                      0.25,
                      duration,
                    );
                    if (next !== videoHistory.segments) {
                      apply(next, id, { record: false });
                    }
                  }}
                  onTrimDragStart={beginGesture}
                  onTrimComplete={commitTrim}
                />
                <SegmentTimeline
                  duration={duration}
                  segments={audioHistory.segments}
                  selectedId={
                    activeTrack === "audio" ? selectedId : null
                  }
                  currentTime={currentTime}
                  zoom={timelineZoom}
                  disabled={exporting}
                  label="Audio"
                  variant="audio"
                  onSelect={(id) => {
                    setActiveTrack("audio");
                    audioHistory.setSelectedId(id);
                    if (!audioDetached) setAudioDetached(true);
                  }}
                  onSeek={seek}
                  onTrimStart={(id, time) => {
                    setActiveTrack("audio");
                    if (!audioDetached) setAudioDetached(true);
                    const next = trimSegmentStart(
                      audioHistory.segments,
                      id,
                      time,
                    );
                    if (next !== audioHistory.segments) {
                      apply(next, id, { record: false });
                    }
                  }}
                  onTrimEnd={(id, time) => {
                    setActiveTrack("audio");
                    if (!audioDetached) setAudioDetached(true);
                    const next = trimSegmentEnd(
                      audioHistory.segments,
                      id,
                      time,
                      0.25,
                      duration,
                    );
                    if (next !== audioHistory.segments) {
                      apply(next, id, { record: false });
                    }
                  }}
                  onTrimDragStart={beginGesture}
                  onTrimComplete={commitTrim}
                />
                {activeTrack === "audio" && (
                  <p className="text-[10px] text-amber-500/80">
                    Editing audio track
                    {audioDetached ? " (detached from video)" : ""}
                  </p>
                )}
              </div>
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
                  Professional cut workflow: split at playhead, drag clip edges to
                  trim, delete gaps, merge adjacent clips. Only green regions
                  export.
                </p>
                <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Keyboard shortcuts
                  </p>
                  <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-gray-500">
                    <li>
                      <kbd className="text-gray-400">Space</kbd> Play / Pause
                    </li>
                    <li>
                      <kbd className="text-gray-400">S</kbd> Split
                    </li>
                    <li>
                      <kbd className="text-gray-400">Del</kbd> Delete clip
                    </li>
                    <li>
                      <kbd className="text-gray-400">M</kbd> Merge next
                    </li>
                    <li>
                      <kbd className="text-gray-400">Ctrl+Z</kbd> Undo
                    </li>
                    <li>
                      <kbd className="text-gray-400">Ctrl+Y</kbd> Redo
                    </li>
                    <li>
                      <kbd className="text-gray-400">← →</kbd> ±0.1s
                    </li>
                    <li>
                      <kbd className="text-gray-400">Shift+←→</kbd> ±1s
                    </li>
                  </ul>
                </div>
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

            {tab === "transform" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Crop, rotate, and flip your recording before export.
                </p>
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <RotateCw className="h-3.5 w-3.5" />
                    Rotation
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([0, 90, 180, 270] as VideoRotation[]).map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setRotation(deg)}
                        className={cn(
                          "rounded-lg border py-2 text-xs font-mono transition",
                          rotation === deg
                            ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                            : "border-gray-800 text-gray-500 hover:border-gray-700",
                        )}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Crop className="h-3.5 w-3.5" />
                    Crop
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ["none", "Original"],
                        ["tight", "Tight 85%"],
                        ["square", "1:1 Square"],
                        ["cinema", "Cinema"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCrop(mode)}
                        className={cn(
                          "rounded-lg border py-2 text-xs transition",
                          crop === mode
                            ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                            : "border-gray-800 text-gray-500 hover:border-gray-700",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </label>
                <ToggleRow
                  label="Flip horizontal"
                  hint="Mirror the video left-to-right"
                  active={flipH}
                  onClick={() => setFlipH((v) => !v)}
                />
              </div>
            )}

            {tab === "effects" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Smooth fade transitions at the start and end of your export.
                </p>
                <label className="block space-y-1.5">
                  <span className="text-xs text-gray-500">
                    Fade in {fadeIn > 0 ? `· ${fadeIn.toFixed(1)}s` : "· off"}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={fadeIn}
                    onChange={(e) => setFadeIn(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-gray-500">
                    Fade out {fadeOut > 0 ? `· ${fadeOut.toFixed(1)}s` : "· off"}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={fadeOut}
                    onChange={(e) => setFadeOut(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </label>
                {(fadeIn > 0 || fadeOut > 0) && (
                  <p className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[11px] text-violet-300/80">
                    Fades apply on export. Preview shows transform only.
                  </p>
                )}
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
                  label="Separate audio track"
                  hint="Cut audio independently from video on the timeline"
                  active={audioDetached}
                  onClick={() => {
                    if (!audioDetached) {
                      audioHistory.apply(
                        videoHistory.segments,
                        videoHistory.selectedId,
                        { record: false },
                      );
                      setActiveTrack("audio");
                    }
                    setAudioDetached((v) => !v);
                  }}
                />
                <ToggleRow
                  label="Noise clean"
                  hint="High-pass + low-pass filter"
                  active={cleanAudio}
                  onClick={() => setCleanAudio((v) => !v)}
                />
                <ToggleRow
                  label="Voice boost"
                  hint="+40% volume on speech"
                  active={voiceBoost}
                  onClick={() => setVoiceBoost((v) => !v)}
                />
                <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
                  <p className="text-xs text-gray-400">
                    Extract audio only — exports a WebM audio track from your
                    kept segments (no video).
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2"
                    disabled={!durationReady || exporting || videoHistory.segments.length === 0}
                    onClick={() => {
                      setAudioDetached(true);
                      setActiveTrack("audio");
                      void runExport(true, "audio");
                    }}
                  >
                    <Music className="h-4 w-4" />
                    Export audio only
                  </Button>
                </div>
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

                <div className="border-t border-gray-800/80 pt-3 space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Image overlay
                  </p>
                  <input
                    ref={stickerInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      setStickerFile(e.target.files?.[0] ?? null)
                    }
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => stickerInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    {stickerFile ? stickerFile.name : "Add image / sticker"}
                  </Button>
                  {stickerFile && (
                    <>
                      <p className="text-xs leading-relaxed text-gray-500">
                        Drag the image on the preview to move it. Use the corner
                        handle to resize and the top handle to rotate.
                      </p>
                      <label className="block space-y-1.5">
                        <span className="text-xs text-gray-500">
                          Opacity{" "}
                          {Math.round(stickerPlacement.opacity * 100)}%
                        </span>
                        <input
                          type="range"
                          min={0.2}
                          max={1}
                          step={0.05}
                          value={stickerPlacement.opacity}
                          onChange={(e) =>
                            setStickerPlacement((p) => ({
                              ...p,
                              opacity: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-blue-500"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs text-gray-500">
                          Size {Math.round(stickerPlacement.scale * 100)}%
                        </span>
                        <input
                          type="range"
                          min={0.08}
                          max={0.85}
                          step={0.02}
                          value={stickerPlacement.scale}
                          onChange={(e) =>
                            setStickerPlacement((p) => ({
                              ...p,
                              scale: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-blue-500"
                        />
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-gray-500"
                        onClick={() => {
                          setStickerFile(null);
                          setStickerPlacement(DEFAULT_OVERLAY_PLACEMENT);
                        }}
                      >
                        Remove image
                      </Button>
                    </>
                  )}
                </div>
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
              disabled={!durationReady || exporting || videoHistory.segments.length === 0}
              onClick={() => void runExport(true)}
            >
              <Download className="h-4 w-4" />
              Export video
            </Button>
            <Button
              variant="secondary"
              className="w-full gap-2"
              disabled={!durationReady || exporting || videoHistory.segments.length === 0}
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
