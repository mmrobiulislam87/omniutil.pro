"use client";

import { useCallback, useRef, useState } from "react";
import {
  cloneSegments,
  cloneSnapshot,
  type SegmentSnapshot,
} from "@/utils/editorHistory";
import type { TimelineSegment } from "@/utils/editorSegments";

const MAX_DEPTH = 50;

export function useSegmentHistory() {
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<SegmentSnapshot[]>([]);
  const [future, setFuture] = useState<SegmentSnapshot[]>([]);
  const gestureRef = useRef<SegmentSnapshot | null>(null);

  const reset = useCallback((initial: TimelineSegment[]) => {
    setSegments(cloneSegments(initial));
    setSelectedId(initial[0]?.id ?? null);
    setPast([]);
    setFuture([]);
  }, []);

  const apply = useCallback(
    (
      next: TimelineSegment[],
      nextSelected?: string | null,
      options?: { record?: boolean },
    ) => {
      const record = options?.record !== false;
      if (record) {
        setPast((p) => [
          ...p.slice(-(MAX_DEPTH - 1)),
          cloneSnapshot({ segments, selectedId }),
        ]);
        setFuture([]);
      }
      setSegments(cloneSegments(next));
      if (nextSelected !== undefined) setSelectedId(nextSelected);
    },
    [segments, selectedId],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [...f, cloneSnapshot({ segments, selectedId })]);
      setSegments(cloneSegments(prev.segments));
      setSelectedId(prev.selectedId);
      return p.slice(0, -1);
    });
  }, [segments, selectedId]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setPast((p) => [...p, cloneSnapshot({ segments, selectedId })]);
      setSegments(cloneSegments(next.segments));
      setSelectedId(next.selectedId);
      return f.slice(0, -1);
    });
  }, [segments, selectedId]);

  const beginGesture = useCallback(() => {
    gestureRef.current = cloneSnapshot({ segments, selectedId });
  }, [segments, selectedId]);

  const endGesture = useCallback(() => {
    if (!gestureRef.current) return;
    setPast((p) => [...p.slice(-(MAX_DEPTH - 1)), gestureRef.current!]);
    setFuture([]);
    gestureRef.current = null;
  }, []);

  return {
    segments,
    selectedId,
    setSelectedId,
    reset,
    apply,
    undo,
    redo,
    beginGesture,
    endGesture,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
