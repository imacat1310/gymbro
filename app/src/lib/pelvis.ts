// Geometry for tapping the hip stickers (ADR-023): which part of the photo to zoom into, and where a tap lands.
import type { ViewCapture } from '../db/db'
import { LM } from './pose'

export interface Crop { x: number; y: number; size: number }

/** Square crop around the near-side hip, about 1.4 thigh lengths, kept inside the photo (pixels). */
export function hipCrop(capture: Pick<ViewCapture, 'landmarks' | 'width' | 'height' | 'nearSide'>): Crop {
  const W = capture.width, H = capture.height
  const near = capture.nearSide === 'right' ? { hip: LM.rightHip, knee: LM.rightKnee } : { hip: LM.leftHip, knee: LM.leftKnee }
  const hip = capture.landmarks[near.hip], knee = capture.landmarks[near.knee]
  const thigh = Math.hypot((hip.x - knee.x) * W, (hip.y - knee.y) * H) || H * 0.2
  const size = Math.min(W, H, thigh * 1.4)
  return {
    x: Math.max(0, Math.min(W - size, hip.x * W - size / 2)),
    y: Math.max(0, Math.min(H - size, hip.y * H - size * 0.55)),
    size,
  }
}

/**
 * A tap at (fx, fy), as fractions of the shown crop, to a normalized point on the raw photo. A mirrored display (front
 * camera) shows the crop flipped, so the horizontal fraction is flipped back.
 */
export function tapToPoint(fx: number, fy: number, crop: Crop, mirrored: boolean, W: number, H: number): { x: number; y: number } {
  const x = mirrored ? 1 - fx : fx
  return { x: (crop.x + x * crop.size) / W, y: (crop.y + fy * crop.size) / H }
}
