// Posture capture guidance (features/02-posture-scan.md, ADR-006). Pure functions so they can be unit-tested.
// Landmarks are MediaPipe's normalized coordinates on the raw (un-mirrored) camera frame.
import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { LM } from './pose'

/** 'side' is the left side facing the camera (the original side view); 'side_right' was added later and is optional. */
export type PostureView = 'front' | 'side' | 'side_right' | 'back'

export const VIEW_ORDER: PostureView[] = ['front', 'side', 'side_right', 'back']
/** Views the user may skip during capture. */
export const OPTIONAL_VIEWS: PostureView[] = ['side_right']
export const isSideView = (v: PostureView) => v === 'side' || v === 'side_right'
export const VIEW_LABELS: Record<PostureView, { title: string; instruction: string }> = {
  front: { title: 'Front', instruction: 'Face the camera' },
  side: { title: 'Left side', instruction: 'Turn so your left side faces the camera' },
  side_right: { title: 'Right side', instruction: 'Turn so your right side faces the camera' },
  back: { title: 'Back', instruction: 'Turn your back to the camera' },
}

/** Phone tilt from upright portrait, in degrees. roll = sideways lean, pitch = leaning forward/back. */
export interface Tilt { rollDeg: number; pitchDeg: number }

export type CheckId = 'person' | 'level' | 'light' | 'turn' | 'body' | 'distance' | 'centre' | 'arms'

export interface Check {
  id: CheckId
  ok: boolean
  label: string
  /** What to do about it; shown and spoken when this is the first failing check. */
  hint?: string
  /** Couldn't be measured on this device: shown as a warning, doesn't block capture. */
  soft?: boolean
}

export const LIMITS = {
  /** Sideways tilt skews left/right height comparisons directly, so it is strict (spec: ±2°). */
  maxRollDeg: 2,
  /** Leaning back only changes proportions slightly and phones are usually propped, so it is looser. */
  maxPitchDeg: 5,
  minBrightness: 0.18,
  minVisibility: 0.5,
  /** Body height (crown to feet) as a share of frame height. */
  minSpan: 0.55,
  maxSpan: 0.9,
  edge: 0.02,
  centreBand: 0.15,
  /** Shoulder width ÷ torso height: at least this when facing / facing away … */
  minFrontRatio: 0.45,
  /** … and at most this side-on. */
  maxSideRatio: 0.3,
} as const

const deg = (rad: number) => (rad * 180) / Math.PI

/**
 * Tilt from the accelerometer's gravity vector (DeviceMotionEvent.accelerationIncludingGravity).
 * Uses ratios to the y axis, so it is the same whether the platform reports gravity as +g or −g.
 */
export function tiltFromGravity(x: number, y: number, z: number): Tilt {
  const s = y < 0 ? -1 : 1
  const ay = Math.abs(y)
  return { rollDeg: deg(Math.atan2(s * x, ay)), pitchDeg: deg(Math.atan2(s * z, ay)) }
}

const HEAD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const FEET = [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex]
const PAIRS: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder], [LM.leftHip, LM.rightHip], [LM.leftKnee, LM.rightKnee],
  [LM.leftAnkle, LM.rightAnkle], [LM.leftHeel, LM.rightHeel],
]

const mid = (a: NormalizedLandmark, b: NormalizedLandmark) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Crown and feet in normalized y. The crown is estimated above the face, since no landmark sits on top of the head. */
export function bodyExtent(lms: NormalizedLandmark[]) {
  const faceTop = Math.min(...HEAD.map((i) => lms[i].y))
  const shoulders = mid(lms[LM.leftShoulder], lms[LM.rightShoulder])
  const crown = faceTop - 0.5 * Math.max(0, shoulders.y - lms[LM.nose].y)
  const feet = Math.max(...FEET.map((i) => lms[i].y))
  return { crown, feet, span: feet - crown }
}

/** Shoulder width ÷ torso height, in pixels: high when facing the camera, low side-on. */
export function shoulderRatio(lms: NormalizedLandmark[], width: number, height: number) {
  const ls = lms[LM.leftShoulder], rs = lms[LM.rightShoulder]
  const sh = mid(ls, rs), hip = mid(lms[LM.leftHip], lms[LM.rightHip])
  const shoulderW = Math.hypot((ls.x - rs.x) * width, (ls.y - rs.y) * height)
  const torsoH = Math.hypot((sh.x - hip.x) * width, (sh.y - hip.y) * height)
  return torsoH > 0 ? shoulderW / torsoH : 0
}

/** Which side of the body is nearer the camera (MediaPipe z: smaller = closer). */
export function nearSide(lms: NormalizedLandmark[]): 'left' | 'right' {
  const z = (ids: number[]) => ids.reduce((s, i) => s + lms[i].z, 0)
  return z([LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.leftAnkle]) <= z([LM.rightShoulder, LM.rightHip, LM.rightKnee, LM.rightAnkle])
    ? 'left' : 'right'
}

export interface FrameInput {
  lms: NormalizedLandmark[] | undefined
  width: number
  height: number
  view: PostureView
  /** null = the phone gives no motion data. */
  tilt: Tilt | null
  /** Mean luma 0–1, or null if not measured. */
  brightness: number | null
}

/** Evaluate one live frame. Checks are in priority order: the first failing one is the hint to show. */
export function evaluateFrame({ lms, width, height, view, tilt, brightness }: FrameInput): Check[] {
  const checks: Check[] = []

  if (!tilt) {
    checks.push({ id: 'level', ok: false, soft: true, label: "Level: can't check", hint: 'Make sure the phone stands straight up' })
  } else {
    const roll = Math.abs(tilt.rollDeg), pitch = Math.abs(tilt.pitchDeg)
    const ok = roll <= LIMITS.maxRollDeg && pitch <= LIMITS.maxPitchDeg
    checks.push({
      id: 'level', ok, label: 'Phone level',
      hint: ok ? undefined : roll > LIMITS.maxRollDeg ? 'Straighten the phone, it leans to one side' : 'Stand the phone upright, it is tilted',
    })
  }

  if (brightness !== null) {
    const ok = brightness >= LIMITS.minBrightness
    checks.push({ id: 'light', ok, label: 'Light', hint: ok ? undefined : 'Too dark, turn on more light' })
  }

  if (!lms) {
    checks.unshift({ id: 'person', ok: false, label: 'Body found', hint: 'Step into view' })
    return checks
  }
  checks.unshift({ id: 'person', ok: true, label: 'Body found' })

  const ratio = shoulderRatio(lms, width, height)
  const turnedOk = isSideView(view) ? ratio <= LIMITS.maxSideRatio : ratio >= LIMITS.minFrontRatio
  checks.push({ id: 'turn', ok: turnedOk, label: VIEW_LABELS[view].instruction, hint: turnedOk ? undefined : VIEW_LABELS[view].instruction })

  // Side-on, the far side is hidden, so only one landmark of each pair has to be seen.
  const seen = (i: number) => lms[i].visibility >= LIMITS.minVisibility
  const visible = PAIRS.every(([l, r]) => (isSideView(view) ? seen(l) || seen(r) : seen(l) && seen(r)))
  const { crown, feet, span } = bodyExtent(lms)
  const xs = [...PAIRS.flat(), LM.nose].map((i) => lms[i].x)
  const inFrame = crown >= LIMITS.edge && feet <= 1 - LIMITS.edge && Math.min(...xs) >= LIMITS.edge && Math.max(...xs) <= 1 - LIMITS.edge
  const bodyOk = visible && inFrame
  checks.push({
    id: 'body', ok: bodyOk, label: 'Head to feet in view',
    hint: bodyOk ? undefined : crown < LIMITS.edge ? 'Your head is cut off, step back' : feet > 1 - LIMITS.edge ? 'Your feet are cut off, step back' : 'Make sure your whole body is in view',
  })

  const distOk = span >= LIMITS.minSpan && span <= LIMITS.maxSpan
  checks.push({
    id: 'distance', ok: distOk, label: 'Distance',
    hint: distOk ? undefined : span < LIMITS.minSpan ? 'Step closer' : 'Step back',
  })

  // Raw camera frames are un-mirrored, so a person facing the camera who appears at high x is to their own left.
  const hipX = mid(lms[LM.leftHip], lms[LM.rightHip]).x
  const off = hipX - 0.5
  const centreOk = Math.abs(off) <= LIMITS.centreBand
  let centreHint: string | undefined
  if (!centreOk) {
    if (isSideView(view)) centreHint = 'Move to the middle of the picture'
    else {
      const towardsHighX = view === 'front' ? 'right' : 'left'
      const towardsLowX = view === 'front' ? 'left' : 'right'
      centreHint = `Take a small step to your ${off > 0 ? towardsHighX : towardsLowX}`
    }
  }
  checks.push({ id: 'centre', ok: centreOk, label: 'Centred', hint: centreHint })

  const torsoTop = mid(lms[LM.leftShoulder], lms[LM.rightShoulder]).y
  const torsoBottom = mid(lms[LM.leftHip], lms[LM.rightHip]).y
  const wristLine = torsoTop + 0.7 * (torsoBottom - torsoTop)
  const wrists = [LM.leftWrist, LM.rightWrist].filter((i) => !isSideView(view) || seen(i))
  const armsOk = wrists.every((i) => lms[i].y >= wristLine)
  checks.push({ id: 'arms', ok: armsOk, label: 'Arms down', hint: armsOk ? undefined : 'Let your arms hang by your sides' })

  return checks
}

/** True when every check passed, apart from ones that couldn't be measured. */
export const readyToCapture = (checks: Check[]) => checks.every((c) => c.ok || c.soft)
export const firstHint = (checks: Check[]) => checks.find((c) => !c.ok && !c.soft)?.hint

export interface MotionSample { t: number; pts: { x: number; y: number }[] }

/** Points tracked for stillness: shoulder, hip and ankle midpoints. */
export function motionPoints(lms: NormalizedLandmark[]) {
  return [
    mid(lms[LM.leftShoulder], lms[LM.rightShoulder]),
    mid(lms[LM.leftHip], lms[LM.rightHip]),
    mid(lms[LM.leftAnkle], lms[LM.rightAnkle]),
  ]
}

/**
 * Still = over the last `windowMs`, no tracked point moved more than `tol` × body span from its average.
 * Needs samples covering most of the window, so a single frame never counts as still.
 */
export function isStill(samples: MotionSample[], now: number, span: number, windowMs = 800, tol = 0.012): boolean {
  const recent = samples.filter((s) => now - s.t <= windowMs)
  if (recent.length < 5 || now - recent[0].t < windowMs * 0.75 || span <= 0) return false
  const n = recent[0].pts.length
  for (let p = 0; p < n; p++) {
    const mx = recent.reduce((s, r) => s + r.pts[p].x, 0) / recent.length
    const my = recent.reduce((s, r) => s + r.pts[p].y, 0) / recent.length
    if (recent.some((r) => Math.hypot(r.pts[p].x - mx, r.pts[p].y - my) > tol * span)) return false
  }
  return true
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const round = (v: number, dp = 4) => Math.round(v * 10 ** dp) / 10 ** dp

/** Per-landmark median over several frames, which removes single-frame jitter. */
export function medianLandmarks<T extends Landmark>(frames: T[][]): Landmark[] {
  const n = frames[0]?.length ?? 0
  return Array.from({ length: n }, (_, i) => ({
    x: round(median(frames.map((f) => f[i].x))),
    y: round(median(frames.map((f) => f[i].y))),
    z: round(median(frames.map((f) => f[i].z))),
    visibility: round(median(frames.map((f) => f[i].visibility)), 3),
  }))
}

/**
 * Jitter between frames: median distance of the key landmarks from their median position,
 * as a share of body span. Low = steady capture; used as a quality signal for the analysis step.
 */
export function landmarkSpread(frames: NormalizedLandmark[][], agg: Landmark[]): number {
  const span = bodyExtent(agg).span
  if (!span || frames.length < 2) return 0
  const keys = PAIRS.flat()
  const d = frames.flatMap((f) => keys.map((i) => Math.hypot(f[i].x - agg[i].x, f[i].y - agg[i].y)))
  return round(median(d) / span)
}
