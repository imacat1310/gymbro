// Progression engine (features/05-session-tracker.md). Pure functions, so they can be unit tested.
import { isLowerBody, type Exercise } from '../data/exercises'
import type { Target } from './targets'

export interface LoggedSet {
  weightKg: number
  /** Reps, or seconds for timed exercises. */
  reps: number
  rpe?: number
}

export type SuggestionKind = 'new' | 'increase' | 'repeat' | 'deload' | 'more_reps' | 'more_time'

export interface Suggestion {
  /** null = no history; the user picks a starting weight. */
  weightKg: number | null
  reps: number
  kind: SuggestionKind
  reason: string
}

/** Estimated 1RM: Epley on reps + reps-in-reserve (from RPE) so submaximal sets aren't underestimated. */
export function e1rm(weightKg: number, reps: number, rpe?: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  const rir = rpe === undefined ? 0 : Math.max(0, 10 - rpe)
  const effective = reps + rir
  return effective <= 1 ? weightKg : weightKg * (1 + effective / 30)
}

/** Smallest sensible load jump for this exercise, in kg. 0 = not load-based. */
export function loadIncrement(ex: Exercise): number {
  switch (ex.load) {
    case 'barbell': return isLowerBody(ex) && ex.mechanics === 'compound' ? 5 : 2.5
    case 'dumbbell': return 2
    case 'kettlebell': return 4
    case 'machine': return 5
    case 'cable': return 2.5
    default: return 0
  }
}

export function roundToIncrement(weightKg: number, increment: number): number {
  if (increment <= 0) return Math.round(weightKg * 4) / 4
  return Math.round(Math.round(weightKg / increment) * increment * 100) / 100
}

export function fmtKg(kg: number) {
  return `${+kg.toFixed(2)} kg`
}
const fmt = fmtKg

function topWeightSets(sets: LoggedSet[]) {
  const top = Math.max(...sets.map((s) => s.weightKg))
  return { top, sets: sets.filter((s) => s.weightKg === top) }
}

function missedMin(sets: LoggedSet[], repMin: number) {
  return sets.some((s) => s.reps < repMin)
}

/**
 * Suggest weight and reps for the next session.
 * @param history working sets per past session, most recent first
 */
export function suggestNext(ex: Exercise, target: Target, history: LoggedSet[][], opts: { blockIncrease?: string } = {}): Suggestion {
  const recent = history.filter((s) => s.length > 0)
  if (recent.length === 0) {
    if (ex.measure === 'time') return { weightKg: null, reps: target.repMin, kind: 'new', reason: `First time: hold for about ${target.repMin} s` }
    if (loadIncrement(ex) === 0) return { weightKg: null, reps: target.repMax, kind: 'new', reason: `First time: do as many good reps as you can, up to ${target.repMax}` }
    return { weightKg: null, reps: target.repMax, kind: 'new', reason: `First time: pick a weight you could lift about ${target.repMax + 2} times` }
  }

  const last = recent[0]
  const { top, sets } = topWeightSets(last)
  const minReps = Math.min(...sets.map((s) => s.reps))

  if (ex.measure === 'time') {
    return { weightKg: top || null, reps: minReps + 5, kind: 'more_time', reason: `Last time ${minReps} s minimum → aim for ${minReps + 5} s` }
  }

  const inc = loadIncrement(ex)
  if (inc === 0) {
    const next = Math.max(minReps + 1, target.repMin)
    return { weightKg: top, reps: next, kind: 'more_reps', reason: `Last time ${sets.map((s) => s.reps).join(', ')} reps → aim for ${next} per set` }
  }

  const repsList = sets.map((s) => s.reps).join(', ')
  const allTop = sets.every((s) => s.reps >= target.repMax)
  const hardSet = sets.find((s) => s.rpe !== undefined && s.rpe > target.targetRpe + 1)

  if (allTop && !hardSet) {
    if (opts.blockIncrease) {
      return { weightKg: top, reps: target.repMax, kind: 'repeat', reason: `Ready to increase, but held back: ${opts.blockIncrease}` }
    }
    const next = roundToIncrement(top + inc, inc)
    return { weightKg: next, reps: target.repMin, kind: 'increase', reason: `You hit ${repsList} @ ${fmt(top)}, the top of your ${target.repMin}–${target.repMax} range → +${fmt(inc)}` }
  }

  if (allTop && hardSet) {
    return { weightKg: top, reps: target.repMax, kind: 'repeat', reason: `Top reps but RPE ${hardSet.rpe} is above your target ${target.targetRpe}. Same weight until it feels easier` }
  }

  if (!missedMin(sets, target.repMin)) {
    const next = Math.min(target.repMax, minReps + 1)
    return { weightKg: top, reps: next, kind: 'repeat', reason: `${repsList} @ ${fmt(top)} → same weight, aim for ${next} reps on every set` }
  }

  // Missed the bottom of the range: deload if it happened last session too at the same or higher weight.
  const prev = recent[1]
  if (prev) {
    const p = topWeightSets(prev)
    if (p.top >= top && missedMin(p.sets, target.repMin)) {
      const next = Math.min(top - inc, roundToIncrement(top * 0.9, inc))
      return { weightKg: Math.max(0, next), reps: target.repMax, kind: 'deload', reason: `Missed ${target.repMin} reps two sessions in a row → −10% to ${fmt(next)} and build back up` }
    }
  }
  return { weightKg: top, reps: target.repMin, kind: 'repeat', reason: `Missed ${target.repMin} reps last time (${repsList}). Same weight, aim for ${target.repMin}` }
}

export interface NextSet {
  weightKg: number
  reps: number
  note?: string
}

/** Adjust the next set within a session from how the last one felt (§ Within-session adjustment). */
export function adjustNextSet(planned: NextSet, last: LoggedSet, target: Target, increment: number): NextSet {
  if (last.rpe === undefined || increment <= 0) return planned
  if (last.rpe > target.targetRpe + 1) {
    const w = Math.min(last.weightKg - increment, roundToIncrement(last.weightKg * 0.93, increment))
    return { weightKg: Math.max(0, w), reps: planned.reps, note: `Last set was RPE ${last.rpe} (target ${target.targetRpe}) → lighter` }
  }
  if (last.rpe < target.targetRpe - 1.5 && last.reps >= target.repMax) {
    const w = Math.max(last.weightKg + increment, roundToIncrement(last.weightKg * 1.04, increment))
    return { weightKg: w, reps: planned.reps, note: `Last set was easy (RPE ${last.rpe}) → heavier` }
  }
  return planned
}

export interface WarmupSet { weightKg: number; reps: number }

/** Ramp-up sets for loaded compound lifts. */
export function warmupSets(ex: Exercise, workingKg: number, barKg = 20): WarmupSet[] {
  if (ex.mechanics !== 'compound') return []
  if (ex.load === 'barbell') {
    if (workingKg < 40) return []
    const steps: WarmupSet[] = [{ weightKg: barKg, reps: 10 }]
    for (const [pct, reps] of [[0.5, 5], [0.7, 3], [0.85, 1]] as const) {
      const w = roundToIncrement(workingKg * pct, 2.5)
      if (w > steps[steps.length - 1].weightKg && w < workingKg) steps.push({ weightKg: w, reps })
    }
    return steps
  }
  if (ex.load === 'dumbbell' || ex.load === 'machine' || ex.load === 'cable') {
    const inc = loadIncrement(ex)
    const w = roundToIncrement(workingKg * 0.6, inc)
    return w > 0 && w < workingKg ? [{ weightKg: w, reps: 6 }] : []
  }
  return []
}

export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

/** Plates per side for a barbell load. */
export function platesPerSide(totalKg: number, barKg = 20, plates = PLATES_KG): { plates: number[]; remainderKg: number } {
  let side = (totalKg - barKg) / 2
  const out: number[] = []
  if (side <= 0) return { plates: out, remainderKg: Math.max(0, totalKg - barKg) }
  for (const p of plates) {
    while (side >= p - 1e-9) {
      out.push(p)
      side -= p
    }
  }
  return { plates: out, remainderKg: Math.round(side * 2 * 100) / 100 }
}
