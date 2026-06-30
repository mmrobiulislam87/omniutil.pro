"use client";

import { useCallback, useRef, useState } from "react";
import { Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatRecordingTime } from "@/utils/screenRecorder";
import type { TimelineSegment } from "@/utils/editorSegments";

type SegmentTimelineProps = {
  duration: number;
  segments: TimelineSegment[];
  selectedId: string | null;
  currentTime: number;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onSplit: () => void;
  onDelete: () => void;
};

export function SegmentTimeline({
  duration,
  segments,
  selectedId,
  currentTime,
  disabled,
  onSelect,
  onSeek,
  onSplit,
  onDelete,
}: SegmentTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);

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

  const onPlayheadDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDraggingPlayhead(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingPlayhead || disabled) return;
      onSeek(timeFromClientX(e.clientX));
    },
    [draggingPlayhead, disabled, onSeek, timeFromClientX],
  );

  const onPointerUp = () => setDraggingPlayhead(false);

  const onTrackClick = (e: React.MouseEvent) => {
    if (disabled || draggingPlayhead) return;
    if ((e.target as HTMLElement).closest("[data-segment]")) return;
    onSeek(timeFromClientX(e.clientX));
  };

  const selected = segments.find((s) => s.id === selectedId);
  const canSplit =
    selected &&
    currentTime > selected.start + 0.25 &&
    currentTime < selected.end - 0.25;
  const canDelete = segments.length > 1;

  return (
    <div className="space-y-3 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Timeline
        </p>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || !canSplit}
            onClick={onSplit}
            className="h-8 gap-1.5 text-xs"
          >
            <Scissors className="h-3.5 w-3.5" />
            Split at playhead
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !canDelete || !selectedId}
            onClick={onDelete}
            className="h-8 gap-1.5 text-xs text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete clip
          </Button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Segment timeline"
        className={cn(
          "relative h-16 cursor-pointer overflow-hidden rounded-lg border border-gray-800/80 bg-[#06080f]",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={onTrackClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="absolute inset-x-0 bottom-0 top-6 bg-gradient-to-b from-gray-900/40 to-gray-950" />

        {/* Tick marks */}
        <div className="absolute inset-x-3 top-0 flex h-6 items-end justify-between border-b border-gray-800/60 pb-1">
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <span
              key={r}
              className="font-mono text-[9px] text-gray-600"
            >
              {formatRecordingTime(r * duration * 1000, true)}
            </span>
          ))}
        </div>

        {/* Inactive gaps (parts of timeline not in any segment) */}
        <div className="absolute inset-x-2 bottom-2 top-7 rounded bg-gray-900/60" />

        {segments.map((seg, i) => (
          <button
            key={seg.id}
            type="button"
            data-segment
            onClick={(e) => {
              e.stopPropagation();
              onSelect(seg.id);
              onSeek(seg.start);
            }}
            className={cn(
              "absolute bottom-2 top-7 rounded border transition",
              selectedId === seg.id
                ? "z-10 border-blue-400 bg-blue-500/35 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.4)]"
                : "border-gray-700/80 bg-emerald-600/25 hover:bg-emerald-600/35",
            )}
            style={{
              left: `calc(${pct(seg.start)}% * 0.96 + 2%)`,
              width: `calc(${pct(seg.end - seg.start)}% * 0.96)`,
            }}
            title={`Clip ${i + 1}: ${formatRecordingTime(seg.start * 1000, true)} – ${formatRecordingTime(seg.end * 1000, true)}`}
          >
            <span className="absolute left-1.5 top-1 font-mono text-[9px] text-white/70">
              {i + 1}
            </span>
          </button>
        ))}

        {/* Playhead */}
        <button
          type="button"
          aria-label="Playhead"
          onPointerDown={onPlayheadDown}
          className="absolute bottom-0 top-0 z-20 w-px -translate-x-1/2 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <span className="absolute -top-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-red-500" />
        </button>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-gray-500">
        <span>
          Playhead{" "}
          <span className="text-gray-300">
            {formatRecordingTime(currentTime * 1000, true)}
          </span>
        </span>
        <span>
          {segments.length} clip{segments.length !== 1 ? "s" : ""} ·{" "}
          <span className="text-emerald-400/90">
            {formatRecordingTime(
              segments.reduce((s, seg) => s + (seg.end - seg.start), 0) * 1000,
              true,
            )}{" "}
            kept
          </span>
        </span>
        <span>{formatRecordingTime(duration * 1000, true)}</span>
      </div>
    </div>
  );
}
