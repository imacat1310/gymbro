// Synthetic squat recordings for tests (made-up kinematics, no real person). A simple 2D stick figure:
// shin, thigh and torso segments driven by a 0→1→0 squat phase per rep, plus optional faults.
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { LM } from '../pose'
import type { FormView, PoseFrame, Recording } from '../form/types'

export interface SquatSpec {
  view: FormView
  reps?: number
  /** Thigh angle at the bottom (side view): + below parallel. One value or one per rep. */
  depthDeg?: number | number[]
  /** Torso lean from vertical at the bottom (side view). One value or one per rep. */
  leanDeg?: number | number[]
  /** Heel lift at the bottom, share of leg length (side view). */
  heelRise?: number
  descentSec?: number
  ascentSec?: number
  /** Extra inward knee travel at the bottom, degrees (front view), per side. */
  caveDeg?: { left: number; right: number }
  /** Constant inward knee angle while standing (static valgus), degrees (front view). */
  staticCaveDeg?: number
  /** Hip shift at the bottom, share of hip width, + toward the user's left (front view). */
  hipShift?: number
  /** Thigh ÷ torso length. */
  femurTorso?: number
  /** Landmark visibility (all points). */
  visibility?: number
  fps?: number
  /** Jitter amplitude in normalized units (deterministic). */
  noise?: number
  /** Standing time before the first rep, seconds. */
  standSec?: number
}

const SHIN = 0.22
const THIGH = 0.22
const at = (v: number | number[] | undefined, i: number, fallback: number) => (Array.isArray(v) ? v[i] ?? v[v.length - 1] : v ?? fallback)
const ease = (u: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2
const rad = (d: number) => (d * Math.PI) / 180

export function squatRecording(spec: SquatSpec): Recording {
  const fps = spec.fps ?? 30
  const reps = spec.reps ?? 5
  const torso = THIGH / (spec.femurTorso ?? 0.9)
  const vis = spec.visibility ?? 0.95
  let seed = 42
  const jitter = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return ((seed / 2147483648) * 2 - 1) * (spec.noise ?? 0)
  }

  // Timeline: stand (0.6 s), then per rep: descent, 0.15 s pause, ascent, 0.5 s stand.
  const phases: { t: number; f: number; rep: number; ascending: boolean }[] = []
  const descent = spec.descentSec ?? 1.6, ascent = spec.ascentSec ?? 1.2
  const step = 1 / fps
  let t = 0
  const push = (f: number, rep: number, ascending: boolean) => { phases.push({ t: t * 1000, f, rep, ascending }); t += step }
  for (let s = 0; s < (spec.standSec ?? 0.6); s += step) push(0, 0, false)
  for (let r = 0; r < reps; r++) {
    for (let s = 0; s < descent; s += step) push(ease(s / descent), r, false)
    for (let s = 0; s < 0.15; s += step) push(1, r, false)
    for (let s = 0; s < ascent; s += step) push(1 - ease(s / ascent), r, true)
    for (let s = 0; s < 0.5; s += step) push(0, r, false)
  }

  const frames: PoseFrame[] = phases.map(({ t: time, f, rep }) => {
    const lms: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }))
    const set = (i: number, x: number, yUp: number, v = vis) => { lms[i] = { x: x + jitter(), y: 1 - yUp + jitter(), z: 0, visibility: v } }

    if (spec.view === 'side') {
      // Facing +x. Ankle fixed; shin tilts forward, thigh rotates from vertical to the bottom angle.
      const ankle = { x: 0.45, y: 0.1 }
      const shinTilt = rad(35 * f)
      const knee = { x: ankle.x + SHIN * Math.sin(shinTilt), y: ankle.y + SHIN * Math.cos(shinTilt) }
      const depth = rad(-90 + f * (at(spec.depthDeg, rep, 5) + 90))
      const hip = { x: knee.x - THIGH * Math.cos(depth), y: knee.y - THIGH * Math.sin(depth) }
      const lean = rad(f * at(spec.leanDeg, rep, 35))
      const sh = { x: hip.x + torso * Math.sin(lean), y: hip.y + torso * Math.cos(lean) }
      const heelUp = (spec.heelRise ?? 0) * f * (SHIN + THIGH)
      for (const s of ['left', 'right'] as const) {
        const near = s === 'left'
        const v = near ? vis : vis * 0.6
        const I = s === 'left'
          ? { sh: LM.leftShoulder, hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle, heel: LM.leftHeel, toe: LM.leftFootIndex }
          : { sh: LM.rightShoulder, hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle, heel: LM.rightHeel, toe: LM.rightFootIndex }
        set(I.sh, sh.x, sh.y, v); set(I.hip, hip.x, hip.y, v); set(I.knee, knee.x, knee.y, v)
        set(I.ankle, ankle.x, ankle.y, v); set(I.heel, ankle.x - 0.04, ankle.y - 0.03 + heelUp, v); set(I.toe, ankle.x + 0.1, ankle.y - 0.04, v)
      }
    } else {
      // Facing the camera, person's left on image right. Hips drop; knees can move in; hips can shift.
      const cx = 0.5, hipW = 0.12, stance = 0.16
      const hipY = SHIN + THIGH * (1 - 0.8 * f)
      const shift = (spec.hipShift ?? 0) * hipW * f
      const kneeY = SHIN
      for (const s of ['left', 'right'] as const) {
        const out = s === 'left' ? 1 : -1 // image direction of the user's left/right
        const hip = { x: cx + out * hipW / 2 + shift, y: hipY }
        const ankle = { x: cx + out * stance / 2, y: 0.05 }
        const tY = (hipY - kneeY) / (hipY - ankle.y)
        const lineX = hip.x + (ankle.x - hip.x) * tY
        // Standing leg length: the analysis converts knee offsets to degrees with it.
        const legLen = Math.hypot((hipW - stance) / 2, SHIN + THIGH - ankle.y)
        const caveDeg = (spec.staticCaveDeg ?? 0) + (spec.caveDeg?.[s] ?? 0) * f
        const kneeX = lineX - out * Math.tan(rad(caveDeg)) * (legLen / 2)
        const I = s === 'left'
          ? { sh: LM.leftShoulder, hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle, heel: LM.leftHeel, toe: LM.leftFootIndex }
          : { sh: LM.rightShoulder, hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle, heel: LM.rightHeel, toe: LM.rightFootIndex }
        set(I.sh, cx + out * 0.1 + shift, hipY + torso); set(I.hip, hip.x, hip.y); set(I.knee, kneeX, kneeY)
        set(I.ankle, ankle.x, ankle.y); set(I.heel, ankle.x, ankle.y - 0.02); set(I.toe, ankle.x + out * 0.02, ankle.y - 0.03)
      }
    }
    return { t: time, lms }
  })
  return { exerciseId: 'barbell_back_squat', view: spec.view, width: 1000, height: 1000, frames }
}
