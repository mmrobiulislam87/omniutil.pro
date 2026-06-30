"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatRecordingTime } from "@/utils/screenRecorder";

type VideoTimelineProps = {
  duration: number;
  start: number;
  end: number;
  currentTime: number;
  disabled?: boolean;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
  onSeek: (value: number) => void;
};

const MIN_GAP = 0.25;

export function VideoTimeline({
  duration,
  start,
  end,
  currentTime,
  disabled,
  onStartChange,
  onEndChange,
  onSeek,
}: VideoTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | "playhead" | null>(
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

  const onPointerDown =
    (handle: "start" | "end" | "playhead") =>
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(handle);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || disabled) return;
      const t = timeFromClientX(e.clientX);
      if (dragging === "start") {
        onStartChange(Math.max(0, Math.min(t, end - MIN_GAP)));
      } else if (dragging === "end") {
        onEndChange(Math.min(duration, Math.max(t, start + MIN_GAP)));
      } else {
        onSeek(Math.max(start, Math.min(end, t)));
      }
    },
    [
      dragging,
      disabled,
      duration,
      end,
      start,
      timeFromClientX,
      onEndChange,
      onSeek,
      onStartChange,
    ],
  );

  const onPointerUp = () => setDragging(null);

  const onTrackClick = (e: React.MouseEvent) => {
    if (disabled || dragging) return;
    const t = timeFromClientX(e.clientX);
    if (t >= start && t <= end) onSeek(t);
  };

  return (
    <div className="space-y-2 select-none">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Video timeline"
        className={cn(
          "relative h-12 cursor-pointer rounded-lg bg-gray-900/80",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={onTrackClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Full track */}
        <div className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-800" />

        {/* Selected region */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blue-500/80"
          style={{
            left: `calc(${pct(start)}% * 0.96 + 2%)`,
            width: `calc(${pct(end - start)}% * 0.96)`,
          }}
        />

        {/* Dimmed outside selection */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-lg bg-black/35"
          style={{ width: `${pct(start)}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-lg bg-black/35"
          style={{ width: `${pct(duration - end)}%` }}
        />

        {/* Start handle */}
        <button
          type="button"
          aria-label="Trim start"
          onPointerDown={onPointerDown("start")}
          className="absolute top-1/2 z-10 h-8 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded border border-blue-400 bg-blue-500 shadow-lg shadow-blue-500/30"
          style={{ left: `${pct(start)}%` }}
        />

        {/* End handle */}
        <button
          type="button"
          aria-label="Trim end"
          onPointerDown={onPointerDown("end")}
          className="absolute top-1/2 z-10 h-8 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded border border-blue-400 bg-blue-500 shadow-lg shadow-blue-500/30"
          style={{ left: `${pct(end)}%` }}
        />

        {/* Playhead */}
        <button
          type="button"
          aria-label="Playhead"
          onPointerDown={onPointerDown("playhead")}
          className="absolute top-0 z-20 h-full w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <span className="absolute -top-0.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-white bg-white" />
        </button>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-gray-500">
        <span>{formatRecordingTime(start * 1000, true)}</span>
        <span className="text-blue-400">
          {formatRecordingTime((end - start) * 1000, true)} selected
        </span>
        <span>{formatRecordingTime(end * 1000, true)}</span>
      </div>
    </div>
  );
}

export function NudgeButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-gray-700 bg-gray-900/60 px-2 py-1 font-mono text-[10px] text-gray-400 transition hover:border-gray-600 hover:text-gray-200 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
