"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  clampPlacement,
  type OverlayPlacement,
} from "@/utils/overlayPlacement";

type InteractiveOverlayProps = {
  imageUrl: string;
  placement: OverlayPlacement;
  disabled?: boolean;
  onChange: (placement: OverlayPlacement) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

type DragMode = "move" | "resize" | "rotate" | null;

export function InteractiveOverlay({
  imageUrl,
  placement,
  disabled,
  onChange,
  containerRef,
}: InteractiveOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const dragStart = useRef({
    px: 0,
    py: 0,
    placement: placement,
    angle: 0,
    centerX: 0,
    centerY: 0,
  });

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, [containerRef]);

  const onPointerDown =
    (mode: DragMode) => (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = getContainerRect();
      if (!rect) return;
      setDrag(mode);
      dragStart.current = {
        px: e.clientX,
        py: e.clientY,
        placement: { ...placement },
        angle: Math.atan2(e.clientY - rect.top - placement.y * rect.height, e.clientX - rect.left - placement.x * rect.width),
        centerX: rect.left + placement.x * rect.width,
        centerY: rect.top + placement.y * rect.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const rect = getContainerRect();
      if (!rect) return;
      const start = dragStart.current;

      if (drag === "move") {
        const dx = (e.clientX - start.px) / rect.width;
        const dy = (e.clientY - start.py) / rect.height;
        onChange(
          clampPlacement({
            ...start.placement,
            x: start.placement.x + dx,
            y: start.placement.y + dy,
          }),
        );
      } else if (drag === "resize") {
        const cx = rect.left + start.placement.x * rect.width;
        const dist = Math.abs(e.clientX - cx);
        const scale = Math.max(0.08, Math.min(0.85, (dist * 2) / rect.width));
        onChange(clampPlacement({ ...start.placement, scale }));
      } else if (drag === "rotate") {
        const cx = start.centerX;
        const cy = start.centerY;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const deg = (angle * 180) / Math.PI + 90;
        onChange(
          clampPlacement({ ...start.placement, rotation: deg }),
        );
      }
    };

    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, getContainerRect, onChange]);

  const w = `${placement.scale * 100}%`;

  return (
    <div
      ref={overlayRef}
      className={cn(
        "absolute z-20 touch-none",
        disabled && "pointer-events-none opacity-60",
      )}
      style={{
        left: `${placement.x * 100}%`,
        top: `${placement.y * 100}%`,
        width: w,
        transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
        opacity: placement.opacity,
      }}
    >
      <div
        className={cn(
          "relative rounded border-2 border-dashed border-blue-400/70 bg-black/20",
          drag === "move" && "border-blue-300",
        )}
        onPointerDown={onPointerDown("move")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Overlay"
          className="pointer-events-none block h-auto w-full select-none"
          draggable={false}
        />

        {!disabled && (
          <>
            <button
              type="button"
              aria-label="Resize overlay"
              onPointerDown={onPointerDown("resize")}
              className="absolute -bottom-1.5 -right-1.5 z-30 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500 shadow"
            />
            <button
              type="button"
              aria-label="Rotate overlay"
              onPointerDown={onPointerDown("rotate")}
              className="absolute -top-7 left-1/2 z-30 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-white/80 bg-gray-900/90 text-white shadow active:cursor-grabbing"
            >
              <RotateCw className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
