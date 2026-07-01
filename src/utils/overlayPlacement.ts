export type OverlayPlacement = {
  /** Center X, 0–1 within preview */
  x: number;
  /** Center Y, 0–1 within preview */
  y: number;
  /** Width as fraction of preview width */
  scale: number;
  rotation: number;
  opacity: number;
};

export const DEFAULT_OVERLAY_PLACEMENT: OverlayPlacement = {
  x: 0.5,
  y: 0.5,
  scale: 0.35,
  rotation: 0,
  opacity: 0.9,
};

export function clampPlacement(p: OverlayPlacement): OverlayPlacement {
  return {
    x: Math.max(0.05, Math.min(0.95, p.x)),
    y: Math.max(0.05, Math.min(0.95, p.y)),
    scale: Math.max(0.08, Math.min(0.85, p.scale)),
    rotation: ((p.rotation % 360) + 360) % 360,
    opacity: Math.max(0.1, Math.min(1, p.opacity)),
  };
}

/** ffmpeg overlay expression from normalized center */
export function overlayCenterExpr(x: number, y: number): string {
  return `x='(main_w*${x})-overlay_w/2':y='(main_h*${y})-overlay_h/2'`;
}
