"use client";

import { useCallback, useEffect, useRef } from "react";

/** Window-level pointer move/up while scrubbing (fixes capture on narrow handles). */
export function useWindowPointerDrag(
  onMove: (clientX: number) => void,
  onEnd?: () => void,
) {
  const draggingRef = useRef(false);
  const onMoveRef = useRef(onMove);
  const onEndRef = useRef(onEnd);
  onMoveRef.current = onMove;
  onEndRef.current = onEnd;

  useEffect(() => {
    return () => {
      draggingRef.current = false;
    };
  }, []);

  return useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    onMoveRef.current(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      onMoveRef.current(ev.clientX);
    };

    const onPointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      onEndRef.current?.();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, []);
}
