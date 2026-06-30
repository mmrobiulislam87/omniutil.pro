import type { TimelineSegment } from "@/utils/editorSegments";

export type SegmentSnapshot = {
  segments: TimelineSegment[];
  selectedId: string | null;
};

export function cloneSegments(segments: TimelineSegment[]): TimelineSegment[] {
  return segments.map((s) => ({ ...s }));
}

export function cloneSnapshot(s: SegmentSnapshot): SegmentSnapshot {
  return { segments: cloneSegments(s.segments), selectedId: s.selectedId };
}
