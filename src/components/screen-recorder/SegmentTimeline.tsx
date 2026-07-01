"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatRecordingTime } from "@/utils/screenRecorder";
import type { TimelineSegment } from "@/utils/editorSegments";

type SegmentTimelineProps = {
  duration: number;
  segments: TimelineSegment[];
  selectedId: string | null;
  currentTime: number;
  zoom: number;
  disabled?: boolean;
  label?: string;
  variant?: "video" | "audio";
  onSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onTrimStart: (id: string, time: number) => void;
  onTrimEnd: (id: string, time: number) => void;
  onTrimDragStart?: () => void;
  onTrimComplete?: () => void;
};

type DragMode = "playhead" | "trim-start" | "trim-end" | null;

export function SegmentTimeline({
  duration,
  segments,
  selectedId,
  currentTime,
  zoom,
  disabled,
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
  const [dragging, setDragging] = useState<DragMode>(null);
  const [dragSegId, setDragSegId] = useState<string | null>(null);

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

  const startDrag =
    (mode: DragMode, segId?: string) => (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(mode);
      setDragSegId(segId ?? null);
      if (mode === "trim-start" || mode === "trim-end") {
        onTrimDragStart?.();
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || disabled) return;
      const t = timeFromClientX(e.clientX);
      if (dragging === "playhead") {
        onSeek(t);
      } else if (dragging === "trim-start" && dragSegId) {
        onTrimStart(dragSegId, t);
      } else if (dragging === "trim-end" && dragSegId) {
        onTrimEnd(dragSegId, t);
      }
    },
    [dragging, disabled, dragSegId, onSeek, onTrimStart, onTrimEnd, timeFromClientX],
  );

  const onPointerUp = () => {
    if (dragging === "trim-start" || dragging === "trim-end") {
      onTrimComplete?.();
    }
    setDragging(null);
    setDragSegId(null);
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (disabled || dragging) return;
    if ((e.target as HTMLElement).closest("[data-segment]")) return;
    onSeek(timeFromClientX(e.clientX));
  };

  const isAudio = variant === "audio";
  const kept = segments.reduce((s, seg) => s + (seg.end - seg.start), 0);

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
            {formatRecordingTime(kept * 1000, true)} kept
          </span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800/80 bg-[#06080f]">
        <div
          ref={trackRef}
          role="slider"
          aria-label={isAudio ? "Audio timeline" : "Video timeline"}
          className={cn(
            "relative min-w-full cursor-pointer",
            isAudio ? "h-[3.25rem]" : "h-[4.5rem]",
            disabled && "pointer-events-none opacity-50",
          )}
          style={{ width: `${zoom * 100}%` }}
          onClick={onTrackClick}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
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
                "bg-[repeating-linear-gradient(90deg,rgba(251,191,36,0.06)_0px,rgba(251,191,36,0.06)_2px,transparent_2px,transparent_6px)]",
            )}
          />

          {/* Removed / gap regions */}
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

                {selected && !disabled && (
                  <>
                    <button
                      type="button"
                      aria-label="Trim start"
                      onPointerDown={startDrag("trim-start", seg.id)}
                      className="absolute bottom-0 left-0 top-0 z-20 w-2.5 cursor-ew-resize rounded-l border-l-2 border-white/70 bg-white/10 hover:bg-white/25"
                    />
                    <button
                      type="button"
                      aria-label="Trim end"
                      onPointerDown={startDrag("trim-end", seg.id)}
                      className="absolute bottom-0 right-0 top-0 z-20 w-2.5 cursor-ew-resize rounded-r border-r-2 border-white/70 bg-white/10 hover:bg-white/25"
                    />
                  </>
                )}
              </div>
            );
          })}

          <button
            type="button"
            aria-label="Playhead"
            onPointerDown={startDrag("playhead")}
            className="absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)]"
            style={{ left: `${pct(currentTime)}%` }}
          >
            <span className="absolute -top-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent border-t-red-500" />
          </button>
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
