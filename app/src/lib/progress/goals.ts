// Goals (Design.md "Goals and badges", ADR-018). A goal stores only what the user set (and the starting value);
// progress, achievement and pace are derived from logged sets and InBody results, like the level.
import { EXERCISE_BY_ID } from '../../data/exercises'
import type { BodyComp, Goal, SetLog } from '../../db/db'
import type { InBodyField } from '../inbody'
import { e1rm } from '../progression'

export type BodyMetric = Extract<InBodyField, 'weightKg' | 'pbf' | 'smmKg' | 'bodyFatKg'>

export const BODY_METRICS: Record<BodyMetric, { label: string; unit: string; dp: number }> = {
  weightKg: { label: 'Body weight', unit: 'kg', dp: 1 },
  pbf: { label: 'Body fat', unit: '%', dp: 1 },
  smmKg: { label: 'Skeletal muscle', unit: 'kg', dp: 1 },
  bodyFatKg: { label: 'Fat mass', unit: 'kg', dp: 1 },
}

export type Pace = 'ahead' | 'on_track' | 'behind' | 'missed'

export interface GoalStatus {
  title: string
  unit: string
  start?: number
  current?: number
  target: number
  /** 0–1 from start to target; undefined until there is data. */
  progress?: number
  achieved: boolean
  achievedAt?: number
  pace?: Pace
}

/** Pace margin: within ±10 percentage points of the straight line to the deadline counts as on track. */
export const PACE_MARGIN = 0.1

const r1 = (v: number) => Math.round(v * 10) / 10

/** Target e1RM for a lift goal ("100 kg × 1" → 100; "80 kg × 8" → about 101). */
export const liftTarget = (g: Goal) => e1rm(g.targetKg ?? 0, g.targetReps ?? 1)

export function goalTitle(g: Goal): string {
  if (g.kind === 'lift') {
    const name = EXERCISE_BY_ID.get(g.exerciseId ?? '')?.name ?? g.exerciseId
    return `${name}: ${g.targetKg} kg${(g.targetReps ?? 1) > 1 ? ` × ${g.targetReps}` : ''}`
  }
  const m = BODY_METRICS[g.metric!]
  return `${m.label}: ${g.target}${m.unit === '%' ? '%' : ` ${m.unit}`}`
}

export function evaluateGoal(g: Goal, sets: SetLog[], comps: BodyComp[], now: number): GoalStatus {
  let status: GoalStatus
  if (g.kind === 'lift') {
    const target = r1(liftTarget(g))
    const mine = sets.filter((s) => s.exerciseId === g.exerciseId && s.kind === 'working' && s.weightKg > 0)
      .sort((a, b) => a.completedAt - b.completedAt)
    let best = 0
    let achievedAt: number | undefined
    for (const s of mine) {
      best = Math.max(best, e1rm(s.weightKg, s.reps, s.rpe))
      // Met before the goal was set → achieved from the start; otherwise on the first set that reaches it.
      if (achievedAt === undefined && best >= target - 0.05) achievedAt = Math.max(s.completedAt, g.createdAt)
    }
    const start = g.start
    const current = mine.length ? r1(best) : undefined
    status = {
      title: goalTitle(g), unit: 'kg e1RM', start, current, target,
      progress: current === undefined ? undefined : progressBetween(start ?? 0, current, target),
      achieved: achievedAt !== undefined, achievedAt,
    }
  } else {
    const metric = g.metric!
    const series = comps.filter((c) => c.values[metric] !== undefined).sort((a, b) => a.measuredAt - b.measuredAt)
    const latest = series.at(-1)?.values[metric]
    const start = g.start ?? series.filter((c) => c.measuredAt <= g.createdAt).at(-1)?.values[metric]
    const down = start !== undefined ? g.target! < start : false
    const met = (v: number) => (down ? v <= g.target! : v >= g.target!)
    const hit = start === undefined ? undefined : series.find((c) => c.measuredAt >= g.createdAt && met(c.values[metric]!))
    status = {
      title: goalTitle(g), unit: BODY_METRICS[metric].unit, start, current: latest, target: g.target!,
      progress: latest === undefined || start === undefined ? undefined : progressBetween(start, latest, g.target!),
      achieved: !!hit, achievedAt: hit?.measuredAt,
    }
  }

  if (g.deadline && !status.achieved) {
    if (now > g.deadline) status.pace = 'missed'
    else if (status.progress !== undefined && g.deadline > g.createdAt) {
      const expected = (now - g.createdAt) / (g.deadline - g.createdAt)
      status.pace = status.progress >= expected + PACE_MARGIN ? 'ahead' : status.progress < expected - PACE_MARGIN ? 'behind' : 'on_track'
    }
  }
  return status
}

/** Share of the way from start to target, 0–1, in either direction. */
export function progressBetween(start: number, current: number, target: number): number {
  if (target === start) return current === target ? 1 : 0
  return Math.max(0, Math.min(1, (current - start) / (target - start)))
}

/** Starting value when a goal is created: best e1RM so far, or the latest InBody value. */
export function startingValue(g: Pick<Goal, 'kind' | 'exerciseId' | 'metric'>, sets: SetLog[], comps: BodyComp[]): number | undefined {
  if (g.kind === 'lift') {
    const mine = sets.filter((s) => s.exerciseId === g.exerciseId && s.kind === 'working' && s.weightKg > 0)
    return mine.length ? r1(Math.max(...mine.map((s) => e1rm(s.weightKg, s.reps, s.rpe)))) : undefined
  }
  return comps.filter((c) => c.values[g.metric!] !== undefined).sort((a, b) => a.measuredAt - b.measuredAt).at(-1)?.values[g.metric!]
}
