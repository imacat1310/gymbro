import { describe, expect, it } from 'vitest'
import type { BodyComp, Goal, SetLog } from '../../db/db'
import { evaluateGoal, goalTitle, liftTarget, progressBetween, startingValue } from './goals'

const DAY = 86_400_000
const T0 = new Date(2026, 8, 1).getTime()
const set = (day: number, kg: number, reps: number, ex = 'barbell_bench_press'): SetLog =>
  ({ id: `${ex}${day}${kg}${reps}`, sessionId: `s${day}`, entryKey: ex, exerciseId: ex, kind: 'working', weightKg: kg, reps, completedAt: T0 + day * DAY })
const comp = (day: number, values: BodyComp['values']): BodyComp => ({ id: `c${day}`, measuredAt: T0 + day * DAY, values, source: 'manual', createdAt: T0 + day * DAY })
const lift = (over: Partial<Goal> = {}): Goal => ({ id: 'g', kind: 'lift', exerciseId: 'barbell_bench_press', targetKg: 100, targetReps: 1, createdAt: T0 + 10 * DAY, start: 85, ...over })
const body = (over: Partial<Goal> = {}): Goal => ({ id: 'b', kind: 'body', metric: 'pbf', target: 15, createdAt: T0 + 10 * DAY, start: 20, ...over })

describe('lift goals (estimated one-rep max)', () => {
  it('titles and targets', () => {
    expect(goalTitle(lift())).toBe('Bench press: 100 kg')
    expect(goalTitle(lift({ targetKg: 80, targetReps: 8 }))).toBe('Bench press: 80 kg × 8')
    expect(liftTarget(lift())).toBe(100)
    expect(liftTarget(lift({ targetKg: 80, targetReps: 8 }))).toBeCloseTo(101.3, 1)
  })
  it('progress from the starting e1RM; 95 × 3 counts toward 100 × 1', () => {
    const s = evaluateGoal(lift(), [set(5, 85, 1), set(20, 95, 3)], [], T0 + 21 * DAY)
    expect(s.current).toBeCloseTo(104.5, 1) // Epley: 95 × (1 + 3/30)
    expect(s.achieved).toBe(true)
    expect(s.achievedAt).toBe(T0 + 20 * DAY)
  })
  it('not there yet → partial progress', () => {
    const s = evaluateGoal(lift(), [set(5, 85, 1), set(20, 90, 2)], [], T0 + 21 * DAY)
    expect(s.achieved).toBe(false)
    expect(s.progress).toBeCloseTo((96 - 85) / 15, 2)
  })
  it('already met when set → achieved from the start, even with later sets', () => {
    const s = evaluateGoal(lift({ targetKg: 80 }), [set(5, 85, 1), set(15, 90, 1)], [], T0 + 16 * DAY)
    expect(s.achievedAt).toBe(T0 + 10 * DAY)
  })
  it('starting value is the best e1RM so far', () => {
    expect(startingValue({ kind: 'lift', exerciseId: 'barbell_bench_press' }, [set(1, 80, 5), set(2, 85, 1)], [])).toBeCloseTo(93.3, 1)
    expect(startingValue({ kind: 'lift', exerciseId: 'barbell_bench_press' }, [], [])).toBeUndefined()
  })
})

describe('body goals (InBody)', () => {
  it('going down: body fat 20% → 15%', () => {
    const comps = [comp(5, { pbf: 20 }), comp(30, { pbf: 17.5 })]
    const s = evaluateGoal(body(), [], comps, T0 + 31 * DAY)
    expect(s.progress).toBeCloseTo(0.5)
    expect(s.achieved).toBe(false)
  })
  it('reached on a later measurement, with its date', () => {
    const comps = [comp(5, { pbf: 20 }), comp(40, { pbf: 14.8 })]
    const s = evaluateGoal(body(), [], comps, T0 + 41 * DAY)
    expect(s).toMatchObject({ achieved: true, achievedAt: T0 + 40 * DAY, progress: 1 })
  })
  it('going up: muscle 33 → 35 kg', () => {
    const comps = [comp(5, { smmKg: 33 }), comp(30, { smmKg: 35.2 })]
    expect(evaluateGoal(body({ metric: 'smmKg', target: 35, start: 33 }), [], comps, T0 + 31 * DAY).achieved).toBe(true)
  })
  it('no InBody data yet → no progress, not achieved', () => {
    expect(evaluateGoal(body({ start: undefined }), [], [], T0 + 11 * DAY)).toMatchObject({ achieved: false, progress: undefined })
  })
})

describe('pace against a deadline', () => {
  const deadline = T0 + 110 * DAY // 100 days after the goal was set
  const comps = (v: number) => [comp(5, { pbf: 20 }), comp(59, { pbf: v })]
  it('half the time gone, half the way → on track', () => {
    expect(evaluateGoal(body({ deadline }), [], comps(17.5), T0 + 60 * DAY).pace).toBe('on_track')
  })
  it('well ahead / well behind', () => {
    expect(evaluateGoal(body({ deadline }), [], comps(16), T0 + 60 * DAY).pace).toBe('ahead')
    expect(evaluateGoal(body({ deadline }), [], comps(19.5), T0 + 60 * DAY).pace).toBe('behind')
  })
  it('deadline passed without reaching it → missed', () => {
    expect(evaluateGoal(body({ deadline }), [], comps(19), T0 + 120 * DAY).pace).toBe('missed')
  })
  it('achieved goals have no pace', () => {
    expect(evaluateGoal(body({ deadline }), [], comps(14), T0 + 60 * DAY).pace).toBeUndefined()
  })
})

describe('progressBetween', () => {
  it('works in both directions and clamps', () => {
    expect(progressBetween(20, 17.5, 15)).toBeCloseTo(0.5)
    expect(progressBetween(33, 34, 35)).toBeCloseTo(0.5)
    expect(progressBetween(20, 22, 15)).toBe(0)
    expect(progressBetween(20, 10, 15)).toBe(1)
  })
})
