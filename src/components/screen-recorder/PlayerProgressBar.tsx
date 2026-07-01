"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatRecordingTime } from "@/utils/screenRecorder";

type PlayerProgressBarProps = {
  duration: number;
  currentTime: number;
  disabled?: boolean;
  onSeek: (time: number) => void;
};

export function PlayerProgressBar({
  duration,
  currentTime,
  disabled,
  onSeek,
}: PlayerProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

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

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
    onSeek(timeFromClientX(e.clientX));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    onSeek(timeFromClientX(e.clientX));
  };

  const onPointerUp = () => setDragging(false);

  return (
    <div className="space-y-1.5 border-t border-gray-800/60 px-4 py-3">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        className={cn(
          "group relative h-2 cursor-pointer rounded-full bg-gray-800/90",
          disabled && "pointer-events-none opacity-40",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-600/80 to-violet-500/80"
          style={{ width: `${pct}%` }}
        />
        <div
          className={cn(
            "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-md transition-transform",
            dragging ? "scale-110" : "scale-100 group-hover:scale-105",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-gray-500">
        <span className="text-gray-400">
          {formatRecordingTime(currentTime * 1000, true)}
        </span>
        <span>{formatRecordingTime(duration * 1000, true)}</span>
      </div>
    </div>
  );
}
