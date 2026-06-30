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
