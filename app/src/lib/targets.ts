// Default set/rep/RPE/rest targets from goal + intensity + experience (features/03-training-plan.md §3).
// Used until the plan builder (Phase 2) prescribes targets per exercise.
import type { Exercise } from '../data/exercises'

export type Goal = 'hypertrophy' | 'strength' | 'fat_loss' | 'general' | 'athletic'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Intensity = 'easy' | 'moderate' | 'hard' | 'max'

export interface Profile {
  goal: Goal
  experience: Experience
  intensity: Intensity
}

export interface Target {
  sets: number
  repMin: number
  repMax: number
  targetRpe: number
  restSec: number
}

export const GOAL_LABELS: Record<Goal, string> = {
  hypertrophy: 'Build muscle', strength: 'Get stronger', fat_loss: 'Lose fat', general: 'General fitness', athletic: 'Athletic performance',
}
export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'Beginner (< 1 yr)', intermediate: 'Intermediate (1–4 yrs)', advanced: 'Advanced (4+ yrs)',
}
export const INTENSITY_LABELS: Record<Intensity, string> = {
  easy: 'Easy', moderate: 'Moderate', hard: 'Hard', max: 'Max effort',
}

type Range = [repMin: number, repMax: number, restSec: number]
const RANGES: Record<Goal, { compound: Range; isolation: Range }> = {
  strength: { compound: [3, 6, 180], isolation: [6, 10, 90] },
  hypertrophy: { compound: [6, 10, 150], isolation: [10, 15, 75] },
  fat_loss: { compound: [8, 12, 90], isolation: [12, 15, 60] },
  general: { compound: [8, 12, 120], isolation: [12, 15, 75] },
  athletic: { compound: [3, 6, 150], isolation: [8, 12, 90] },
}

const RPE: Record<Intensity, number> = { easy: 6.5, moderate: 7.5, hard: 8.5, max: 9 }

/** Beginners are capped at RPE 8 regardless of chosen intensity (SAFETY_PRIVACY.md). */
export const BEGINNER_RPE_CAP = 8

export function defaultTarget(ex: Exercise, profile: Profile): Target {
  if (ex.measure === 'time') {
    return { sets: 3, repMin: 20, repMax: 45, targetRpe: RPE[profile.intensity], restSec: 60 }
  }
  const [repMin, repMax, restSec] = RANGES[profile.goal][ex.mechanics]
  let targetRpe = RPE[profile.intensity]
  if (profile.experience === 'beginner') targetRpe = Math.min(targetRpe, BEGINNER_RPE_CAP)
  const sets = profile.intensity === 'easy' ? 2 : profile.intensity === 'max' && profile.experience !== 'beginner' ? 4 : 3
  return { sets, repMin, repMax, targetRpe, restSec }
}
