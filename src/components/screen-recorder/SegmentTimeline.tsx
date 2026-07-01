"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { formatRecordingTime } from "@/utils/screenRecorder";
import { useWindowPointerDrag } from "@/hooks/useWindowPointerDrag";
import type { TimelineSegment } from "@/utils/editorSegments";

type SegmentTimelineProps = {
  duration: number;
  segments: TimelineSegment[];
  selectedId: string | null;
  currentTime: number;
  zoom: number;
  disabled?: boolean;
  readOnly?: boolean;
  showPlayhead?: boolean;
  label?: string;
  variant?: "video" | "audio";
  onSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onTrimStart: (id: string, time: number) => void;
  onTrimEnd: (id: string, time: number) => void;
  onTrimDragStart?: () => void;
  onTrimComplete?: () => void;
};

export function SegmentTimeline({
  duration,
  segments,
  selectedId,
  currentTime,
  zoom,
  disabled,
  readOnly,
  showPlayhead = true,
  label,
  variant = "video",
  onSelect,
  onSeek,
  onTrimStart,
  onTrimEnd,
  onTrimDragStart,
  onTrimComplete,
}: SegmentTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragSegIdRef = useRef<string | null>(null);
  const dragModeRef = useRef<"playhead" | "trim-start" | "trim-end" | null>(
    null,
  );

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const handleDragMove = useCallback(
    (clientX: number) => {
      const t = timeFromClientX(clientX);
      const mode = dragModeRef.current;
      const segId = dragSegIdRef.current;
      if (mode === "playhead") {
        onSeek(t);
      } else if (mode === "trim-start" && segId) {
        onTrimStart(segId, t);
      } else if (mode === "trim-end" && segId) {
        onTrimEnd(segId, t);
      }
    },
    [onSeek, onTrimStart, onTrimEnd, timeFromClientX],
  );

  const handleDragEnd = useCallback(() => {
    if (
      dragModeRef.current === "trim-start" ||
      dragModeRef.current === "trim-end"
    ) {
      onTrimComplete?.();
    }
    dragModeRef.current = null;
    dragSegIdRef.current = null;
  }, [onTrimComplete]);

  const startWindowDrag = useWindowPointerDrag(handleDragMove, handleDragEnd);

  const startDrag =
    (mode: "playhead" | "trim-start" | "trim-end", segId?: string) =>
    (e: React.PointerEvent) => {
      if (disabled || readOnly) return;
      e.preventDefault();
      e.stopPropagation();
      dragModeRef.current = mode;
      dragSegIdRef.current = segId ?? null;
      if (mode === "trim-start" || mode === "trim-end") {
        onTrimDragStart?.();
      }
      handleDragMove(e.clientX);
      startWindowDrag(e);
    };

  const onTrackClick = (e: React.MouseEvent) => {
    if (disabled || readOnly) return;
    if ((e.target as HTMLElement).closest("[data-playhead]")) return;
    if ((e.target as HTMLElement).closest("[data-segment]")) return;
    onSeek(timeFromClientX(e.clientX));
  };

  const isAudio = variant === "audio";
  const kept = segments.reduce((s, seg) => s + (seg.end - seg.start), 0);
  const inactive = disabled || readOnly;

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          {label ?? (isAudio ? "Audio track" : "Video track")}
        </p>
        <p className="font-mono text-[10px] text-gray-500">
          {segments.length} clip{segments.length !== 1 ? "s" : ""} ·{" "}
          <span
            className={isAudio ? "text-amber-400/90" : "text-emerald-400/90"}
          >
            {formatRecordingTime(kept * 1000, true)}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800/80 bg-[#06080f]">
        <div
          ref={trackRef}
          role="slider"
          aria-label={isAudio ? "Audio timeline" : "Video timeline"}
          className={cn(
            "relative min-w-full",
            inactive ? "opacity-50" : "cursor-pointer",
            isAudio ? "h-[3.25rem]" : "h-[4.5rem]",
          )}
          style={{ width: `${zoom * 100}%` }}
          onClick={onTrackClick}
        >
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 bg-gradient-to-b from-gray-900/30 to-gray-950",
              isAudio ? "top-5" : "top-7",
            )}
          />

          <div
            className={cn(
              "absolute inset-x-3 top-0 flex items-end justify-between border-b border-gray-800/50 pb-1",
              isAudio ? "h-5" : "h-7",
            )}
          >
            {Array.from({ length: 4 * zoom + 1 }, (_, i) => {
              const r = i / (4 * zoom);
              return (
                <span
                  key={i}
                  className="font-mono text-[9px] text-gray-600"
                  style={{ visibility: i % zoom === 0 ? "visible" : "hidden" }}
                >
                  {formatRecordingTime(r * duration * 1000, true)}
                </span>
              );
            })}
          </div>

          <div
            className={cn(
              "absolute inset-x-2 bottom-2 rounded bg-gray-900/50",
              isAudio ? "top-5" : "top-8",
              isAudio &&
                "bg-[repeating-linear-gradient(90deg,rgba(251,191,36,0.08)_0px,rgba(251,191,36,0.08)_2px,transparent_2px,transparent_6px)]",
            )}
          />

          {segments.length > 0 && (
            <RemovedRegions
              duration={duration}
              segments={segments}
              pct={pct}
              isAudio={isAudio}
            />
          )}

          {segments.map((seg, i) => {
            const selected = selectedId === seg.id;
            return (
              <div
                key={seg.id}
                data-segment
                className={cn(
                  "absolute bottom-2 rounded border transition-colors",
                  isAudio ? "top-5" : "top-8",
                  selected
                    ? isAudio
                      ? "z-10 border-amber-400/90 bg-amber-500/25 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]"
                      : "z-10 border-blue-400/90 bg-blue-500/30 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]"
                    : isAudio
                      ? "border-amber-700/50 bg-amber-600/15 hover:bg-amber-600/25"
                      : "border-emerald-700/60 bg-emerald-600/20 hover:bg-emerald-600/30",
                )}
                style={{
                  left: `calc(${pct(seg.start)}% * 0.96 + 2%)`,
                  width: `calc(${pct(seg.end - seg.start)}% * 0.96)`,
                }}
              >
                <button
                  type="button"
                  className="absolute inset-0 rounded"
                  disabled={inactive}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(seg.id);
                  }}
                  title={`Clip ${i + 1}`}
                />
                <span className="pointer-events-none absolute left-2 top-1 font-mono text-[9px] font-medium text-white/80">
                  {i + 1}
                </span>
                <span className="pointer-events-none absolute bottom-1 right-1.5 font-mono text-[8px] text-white/40">
                  {formatRecordingTime((seg.end - seg.start) * 1000, true)}
                </span>

                {selected && !inactive && (
                  <>
                    <button
                      type="button"
                      aria-label="Trim start"
                      onPointerDown={startDrag("trim-start", seg.id)}
                      className="absolute bottom-0 left-0 top-0 z-20 w-3 cursor-ew-resize rounded-l border-l-2 border-white/80 bg-white/15 hover:bg-white/30"
                    />
                    <button
                      type="button"
                      aria-label="Trim end"
                      onPointerDown={startDrag("trim-end", seg.id)}
                      className="absolute bottom-0 right-0 top-0 z-20 w-3 cursor-ew-resize rounded-r border-r-2 border-white/80 bg-white/15 hover:bg-white/30"
                    />
                  </>
                )}
              </div>
            );
          })}

          {showPlayhead && !inactive && (
            <button
              type="button"
              data-playhead
              aria-label="Playhead — drag to seek"
              onPointerDown={startDrag("playhead")}
              className="absolute bottom-0 top-0 z-40 w-4 -translate-x-1/2 cursor-ew-resize touch-none"
              style={{ left: `${pct(currentTime)}%` }}
            >
              <span className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]" />
              <span className="absolute -top-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-red-500" />
            </button>
          )}
          {showPlayhead && inactive && (
            <span
              className="pointer-events-none absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-red-500/60"
              style={{ left: `${pct(currentTime)}%` }}
              aria-hidden
            />
          )}
        </div>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-gray-500">
        <span>
          IN{" "}
          <span className="text-gray-300">
            {formatRecordingTime(currentTime * 1000, true)}
          </span>
        </span>
        <span>{formatRecordingTime(duration * 1000, true)} total</span>
      </div>
    </div>
  );
}

function RemovedRegions({
  duration,
  segments,
  pct,
  isAudio,
}: {
  duration: number;
  segments: TimelineSegment[];
  pct: (t: number) => number;
  isAudio?: boolean;
}) {
  const gaps: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const s of segments) {
    if (s.start > cursor + 0.01) gaps.push({ start: cursor, end: s.start });
    cursor = s.end;
  }
  if (cursor < duration - 0.01) gaps.push({ start: cursor, end: duration });

  return (
    <>
      {gaps.map((g) => (
        <div
          key={`${g.start}-${g.end}`}
          className={cn(
            "absolute bottom-2 rounded",
            isAudio ? "top-5 bg-red-950/35" : "top-8 bg-red-950/40",
          )}
          style={{
            left: `calc(${pct(g.start)}% * 0.96 + 2%)`,
            width: `calc(${pct(g.end - g.start)}% * 0.96)`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}
