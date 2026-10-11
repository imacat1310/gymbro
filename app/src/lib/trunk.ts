// Trunk rotation test (forward-bend test with the phone as a scoliometer; ADR-010). Pure maths, unit-tested.
// Protocol: the person bends forward; a helper lays the phone across their back, screen up, with the top of the
// phone pointing to the person's RIGHT. The angle across the back is the angle of trunk rotation (ATR).

export type Side = 'left' | 'right'
export type TrunkRegion = 'upper' | 'lower'
export type TrunkGrade = 'normal' | 'borderline' | 'refer'

export interface Gravity { x: number; y: number; z: number }

/** Common screening practice: under 5° normal; 5–6.9° re-test / consider a check; 7° or more, see a professional. */
export const ATR_BORDERLINE = 5
export const ATR_REFER = 7
/** Beyond this tilt along the spine the phone isn't lying on the back (picked up, or slid off). */
const MAX_ALONG_SPINE_DEG = 50

const deg = (r: number) => (r * 180) / Math.PI

/**
 * Signed angle across the back, in degrees: positive = the person's right side is higher.
 * Gravity sign conventions differ between platforms; the phone lies screen up, so z tells us which one is in use.
 * Returns null when the phone isn't lying roughly flat on the back.
 */
export function angleAcross(g: Gravity): number | null {
  const s = g.z < 0 ? -1 : 1
  const x = g.x * s, y = g.y * s, z = Math.abs(g.z)
  if (z < 1 || deg(Math.atan2(Math.abs(x), z)) > MAX_ALONG_SPINE_DEG) return null
  // Top of the phone (device +y) raised → y > 0 → the person's right side is higher.
  return deg(Math.atan2(y, Math.hypot(x, z)))
}

export function gradeAtr(absDeg: number): TrunkGrade {
  return absDeg >= ATR_REFER ? 'refer' : absDeg >= ATR_BORDERLINE ? 'borderline' : 'normal'
}

export const sideOf = (signedDeg: number): Side | undefined => (signedDeg > 0.05 ? 'right' : signedDeg < -0.05 ? 'left' : undefined)

export interface Sample { t: number; deg: number }

/** Median of the last `windowMs`: removes bumps and hand tremor without lagging much. */
export function smoothed(samples: Sample[], now: number, windowMs = 300): number | null {
  const recent = samples.filter((s) => now - s.t <= windowMs).map((s) => s.deg).sort((a, b) => a - b)
  if (recent.length < 3) return null
  const m = Math.floor(recent.length / 2)
  return recent.length % 2 ? recent[m] : (recent[m - 1] + recent[m]) / 2
}

/** Keep the largest-magnitude value seen, with its sign. */
export const peakOf = (peak: number | null, v: number): number => (peak === null || Math.abs(v) > Math.abs(peak) ? v : peak)

/**
 * Calibration offset from readings taken on a flat surface. Needs a steady phone: if readings spread more than
 * 1°, it was moving and the caller should ask again.
 */
export function calibrate(readings: number[]): { offset: number } | { error: 'moving' | 'too_few' | 'not_flat' } {
  if (readings.length < 10) return { error: 'too_few' }
  const sorted = [...readings].sort((a, b) => a - b)
  if (sorted.at(-1)! - sorted[0] > 1) return { error: 'moving' }
  const offset = sorted[Math.floor(sorted.length / 2)]
  // A camera bump tilts a phone by a few degrees; much more means it isn't lying on a flat surface.
  if (Math.abs(offset) > 6) return { error: 'not_flat' }
  return { offset }
}

export interface TrunkResult {
  /** Signed peak per region after calibration: positive = right side higher. */
  regions: Partial<Record<TrunkRegion, number>>
  offsetDeg: number
}

export function summarize(r: TrunkResult): { worst?: { region: TrunkRegion; deg: number }; grade: TrunkGrade } {
  const entries = Object.entries(r.regions) as [TrunkRegion, number][]
  if (!entries.length) return { grade: 'normal' }
  const [region, d] = entries.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a))
  return { worst: { region, deg: d }, grade: gradeAtr(Math.abs(d)) }
}
