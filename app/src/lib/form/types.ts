// Form check (ADR-022): shared types. Analysis is pure and on-device: landmarks in, report out.
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Area } from '../../data/stress'

export type FormView = 'side' | 'front'

/** One video frame's pose: time in ms and the 33 BlazePose landmarks (normalized image coordinates). */
export interface PoseFrame {
  t: number
  lms: NormalizedLandmark[]
}

export interface Recording {
  exerciseId: string
  view: FormView
  /** Video size in pixels, so angles are measured without aspect-ratio distortion. */
  width: number
  height: number
  frames: PoseFrame[]
}

/** What the user's body data says, for personal thresholds and tips (ADR-022 decision 3). */
export interface FormProfile {
  /** Thigh ÷ torso length from the posture scan. */
  femurTorso?: number
  /** Posture scan found knees angling in when standing. */
  staticValgus: boolean
  /** Weaker leg by InBody segmental lean mass. */
  weakLeg?: { side: 'left' | 'right'; diffPct: number }
  limitations: Area[]
}

export const EMPTY_PROFILE: FormProfile = { staticValgus: false, limitations: [] }

export type FaultSeverity = 'mild' | 'moderate' | 'safety'

export type FaultCode =
  | 'shallow' | 'forward_lean' | 'heel_rise' | 'fast_descent' | 'fatigue_breakdown'
  | 'knee_cave' | 'hip_shift'

export interface Fault {
  code: FaultCode
  severity: FaultSeverity
  /** 1-based rep numbers affected (all reps for set-level faults). */
  reps: number[]
  /** Worst measured value, in the fault's unit. */
  value: number
  unit: string
  tip: string
  /** Why this applies to this user, from their body data; absent when it's the general rule. */
  why?: string
}

export interface RepMetrics {
  rep: number
  startT: number
  bottomT: number
  endT: number
  descentSec: number
  ascentSec: number
  /** Side view: thigh angle at the bottom; positive = hip below knee, 0 = parallel. */
  depthDeg?: number
  /** Side view: torso angle from vertical at the bottom. */
  leanDeg?: number
  /** Side view: heel lift as a share of leg length. */
  heelRise?: number
  /** Front view: most inward knee movement vs standing alignment, per side, degrees. */
  kneeCaveDeg?: { left: number; right: number }
  /** Front view: hips' sideways shift at the bottom, share of hip width; positive = toward the user's left. */
  hipShift?: number
}

export interface FormReport {
  exerciseId: string
  view: FormView
  reps: RepMetrics[]
  faults: Fault[]
  /** 0–100 (features/04-form-check.md "Form score"). */
  score: number
  /** Up to two tips, most important first; a short praise line when there are no faults. */
  tips: { text: string; why?: string }[]
  /** Set when the next load increase should wait (safety fault or score < 60). */
  blockIncrease?: string
  /** What this view and version cannot judge, said plainly instead of guessing. */
  notMeasured: string[]
  /** Personal settings that applied, e.g. "Lean limit 55° for your long thighs". */
  personal: string[]
  error?: 'not_visible' | 'no_reps'
}
