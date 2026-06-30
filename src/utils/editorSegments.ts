export type TimelineSegment = {
  id: string;
  start: number;
  end: number;
};

let segCounter = 0;
export function newSegmentId(): string {
  segCounter += 1;
  return `seg-${segCounter}-${Date.now()}`;
}

export function createInitialSegments(duration: number): TimelineSegment[] {
  if (duration <= 0) return [];
  return [{ id: newSegmentId(), start: 0, end: duration }];
}

export function splitSegmentAt(
  segments: TimelineSegment[],
  time: number,
  minLen = 0.25,
): TimelineSegment[] {
  const idx = segments.findIndex((s) => time > s.start + minLen && time < s.end - minLen);
  if (idx === -1) return segments;

  const target = segments[idx];
  const left: TimelineSegment = {
    id: newSegmentId(),
    start: target.start,
    end: time,
  };
  const right: TimelineSegment = {
    id: newSegmentId(),
    start: time,
    end: target.end,
  };

  return [...segments.slice(0, idx), left, right, ...segments.slice(idx + 1)];
}

export function deleteSegment(
  segments: TimelineSegment[],
  id: string,
): TimelineSegment[] {
  const next = segments.filter((s) => s.id !== id);
  return next.length > 0 ? next : segments;
}

export function segmentsDuration(segments: TimelineSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start), 0);
}

export function findSegmentAt(
  segments: TimelineSegment[],
  time: number,
): TimelineSegment | undefined {
  return segments.find((s) => time >= s.start && time <= s.end);
}

export function trimSegmentStart(
  segments: TimelineSegment[],
  id: string,
  newStart: number,
  minLen = 0.25,
): TimelineSegment[] {
  const idx = segments.findIndex((s) => s.id === id);
  if (idx === -1) return segments;
  const seg = segments[idx];
  const prev = segments[idx - 1];
  const floor = prev ? prev.end : 0;
  const start = Math.max(floor, Math.min(newStart, seg.end - minLen));
  if (start === seg.start) return segments;
  return segments.map((s) => (s.id === id ? { ...s, start } : s));
}

export function trimSegmentEnd(
  segments: TimelineSegment[],
  id: string,
  newEnd: number,
  minLen = 0.25,
  maxDuration?: number,
): TimelineSegment[] {
  const idx = segments.findIndex((s) => s.id === id);
  if (idx === -1) return segments;
  const seg = segments[idx];
  const next = segments[idx + 1];
  const ceiling = next ? next.start : (maxDuration ?? seg.end);
  const end = Math.min(ceiling, Math.max(newEnd, seg.start + minLen));
  if (end === seg.end) return segments;
  return segments.map((s) => (s.id === id ? { ...s, end } : s));
}

export function canMergeWithNext(
  segments: TimelineSegment[],
  id: string,
): boolean {
  const idx = segments.findIndex((s) => s.id === id);
  if (idx === -1 || idx >= segments.length - 1) return false;
  const a = segments[idx];
  const b = segments[idx + 1];
  return Math.abs(a.end - b.start) < 0.05;
}

export function mergeWithNext(
  segments: TimelineSegment[],
  id: string,
): TimelineSegment[] {
  const idx = segments.findIndex((s) => s.id === id);
  if (idx === -1 || !canMergeWithNext(segments, id)) return segments;
  const a = segments[idx];
  const b = segments[idx + 1];
  const merged: TimelineSegment = {
    id: a.id,
    start: a.start,
    end: b.end,
  };
  return [...segments.slice(0, idx), merged, ...segments.slice(idx + 2)];
}

export function segmentIndex(segments: TimelineSegment[], id: string): number {
  return segments.findIndex((s) => s.id === id);
}
