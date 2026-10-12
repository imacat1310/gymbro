// Pixel-space geometry and signal helpers for form analysis.
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface Px { x: number; y: number; v: number }

export const DEG = 180 / Math.PI

export const px = (l: NormalizedLandmark | undefined, w: number, h: number): Px =>
  ({ x: (l?.x ?? 0) * w, y: (l?.y ?? 0) * h, v: l?.visibility ?? 0 })

export const mid = (a: Px, b: Px): Px => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) })

export const dist = (a: Px, b: Px) => Math.hypot(a.x - b.x, a.y - b.y)

/** Interior angle at b (degrees). */
export function angleAt(a: Px, b: Px, c: Px): number {
  const abx = a.x - b.x, aby = a.y - b.y, cbx = c.x - b.x, cby = c.y - b.y
  const cos = (abx * cbx + aby * cby) / (Math.hypot(abx, aby) * Math.hypot(cbx, cby) || 1)
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG
}

/** Centered moving average; keeps length. Smooths landmark jitter before thresholds are applied. */
export function smooth(values: number[], window = 5): number[] {
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    let sum = 0, n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) { sum += values[j]; n++ }
    return sum / n
  })
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const r1 = (v: number) => Math.round(v * 10) / 10
