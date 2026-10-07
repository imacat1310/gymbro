import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID } from '../data/exercises'
import {
  adjustNextSet, e1rm, loadIncrement, platesPerSide, roundToIncrement, suggestNext, warmupSets, type LoggedSet,
} from './progression'
import type { Target } from './targets'

const squat = EXERCISE_BY_ID.get('barbell_back_squat')!
const bench = EXERCISE_BY_ID.get('barbell_bench_press')!
const dbCurl = EXERCISE_BY_ID.get('db_curl')!
const pushUp = EXERCISE_BY_ID.get('push_up')!
const plank = EXERCISE_BY_ID.get('plank')!

const T: Target = { sets: 3, repMin: 6, repMax: 8, targetRpe: 8, restSec: 150 }
const sets = (w: number, reps: number[], rpe?: number): LoggedSet[] => reps.map((r) => ({ weightKg: w, reps: r, rpe }))

describe('e1rm', () => {
  it('uses Epley', () => expect(e1rm(100, 5)).toBeCloseTo(116.67, 1))
  it('adds reps in reserve from RPE', () => expect(e1rm(100, 5, 8)).toBeCloseTo(123.33, 1))
  it('a true single is the weight', () => expect(e1rm(140, 1, 10)).toBe(140))
  it('zero for empty sets', () => expect(e1rm(0, 5)).toBe(0))
})

describe('increments and rounding', () => {
  it('lower-body barbell compounds jump 5 kg, upper 2.5 kg', () => {
    expect(loadIncrement(squat)).toBe(5)
    expect(loadIncrement(bench)).toBe(2.5)
    expect(loadIncrement(dbCurl)).toBe(2)
    expect(loadIncrement(pushUp)).toBe(0)
  })
  it('rounds to the increment', () => {
    expect(roundToIncrement(83.4, 2.5)).toBe(82.5)
    expect(roundToIncrement(84, 2.5)).toBe(85)
    expect(roundToIncrement(13.1, 2)).toBe(14)
  })
})

describe('suggestNext (double progression)', () => {
  it('asks for a starting weight with no history', () => {
    const s = suggestNext(bench, T, [])
    expect(s.kind).toBe('new')
    expect(s.weightKg).toBeNull()
  })

  it('increases when every set hits the top of the range', () => {
    const s = suggestNext(bench, T, [sets(80, [8, 8, 8], 7.5)])
    expect(s).toMatchObject({ kind: 'increase', weightKg: 82.5, reps: 6 })
    expect(s.reason).toContain('+2.5 kg')
  })

  it('increases squat by 5 kg', () => {
    expect(suggestNext(squat, T, [sets(100, [8, 8, 8])]).weightKg).toBe(105)
  })

  it('holds weight when top reps came at too high an RPE', () => {
    expect(suggestNext(bench, T, [sets(80, [8, 8, 8], 9.5)])).toMatchObject({ kind: 'repeat', weightKg: 80 })
  })

  it('holds weight and adds a rep inside the range', () => {
    expect(suggestNext(bench, T, [sets(80, [8, 7, 6])])).toMatchObject({ kind: 'repeat', weightKg: 80, reps: 7 })
  })

  it('repeats after one missed session', () => {
    expect(suggestNext(bench, T, [sets(80, [6, 5, 4])])).toMatchObject({ kind: 'repeat', weightKg: 80, reps: 6 })
  })

  it('deloads 10% after two missed sessions in a row', () => {
    const s = suggestNext(bench, T, [sets(80, [6, 5, 4]), sets(80, [6, 5, 5])])
    expect(s).toMatchObject({ kind: 'deload', weightKg: 72.5 })
  })

  it('does not deload if the earlier miss was at a lighter weight', () => {
    expect(suggestNext(bench, T, [sets(82.5, [6, 5, 4]), sets(80, [6, 5, 5])]).kind).toBe('repeat')
  })

  it('uses the top working weight of the last session', () => {
    const last = [...sets(60, [8]), ...sets(80, [8, 8, 8])]
    expect(suggestNext(bench, T, [last]).weightKg).toBe(82.5)
  })

  it('respects a block on increases (form gating)', () => {
    const s = suggestNext(bench, T, [sets(80, [8, 8, 8])], { blockIncrease: 'form score below 60' })
    expect(s).toMatchObject({ kind: 'repeat', weightKg: 80 })
    expect(s.reason).toContain('form score')
  })

  it('progresses reps for bodyweight exercises', () => {
    expect(suggestNext(pushUp, T, [sets(0, [12, 10, 9])])).toMatchObject({ kind: 'more_reps', reps: 10 })
  })

  it('progresses time for timed exercises', () => {
    expect(suggestNext(plank, T, [sets(0, [40, 35, 30])])).toMatchObject({ kind: 'more_time', reps: 35 })
  })

  it('skips empty sessions in history', () => {
    expect(suggestNext(bench, T, [[], sets(80, [8, 8, 8])]).kind).toBe('increase')
  })
})

describe('adjustNextSet', () => {
  const planned = { weightKg: 80, reps: 8 }
  it('drops weight when the last set was too hard', () => {
    const n = adjustNextSet(planned, { weightKg: 80, reps: 6, rpe: 9.5 }, T, 2.5)
    expect(n.weightKg).toBe(75)
    expect(n.note).toMatch(/lighter/)
  })
  it('adds weight when the last set was easy at top reps', () => {
    expect(adjustNextSet(planned, { weightKg: 80, reps: 8, rpe: 6 }, T, 2.5).weightKg).toBe(82.5)
  })
  it('keeps the plan otherwise', () => {
    expect(adjustNextSet(planned, { weightKg: 80, reps: 8, rpe: 8 }, T, 2.5)).toEqual(planned)
    expect(adjustNextSet(planned, { weightKg: 80, reps: 8 }, T, 2.5)).toEqual(planned)
  })
})

describe('warmupSets', () => {
  it('ramps up to a barbell working weight', () => {
    expect(warmupSets(squat, 100)).toEqual([
      { weightKg: 20, reps: 10 }, { weightKg: 50, reps: 5 }, { weightKg: 70, reps: 3 }, { weightKg: 85, reps: 1 },
    ])
  })
  it('skips warm-ups for light barbell work and isolation', () => {
    expect(warmupSets(squat, 30)).toEqual([])
    expect(warmupSets(dbCurl, 14)).toEqual([])
  })
})

describe('platesPerSide', () => {
  it('loads 100 kg as 25 + 15 per side', () => expect(platesPerSide(100)).toEqual({ plates: [25, 15], remainderKg: 0 }))
  it('handles small plates', () => expect(platesPerSide(82.5)).toEqual({ plates: [25, 5, 1.25], remainderKg: 0 }))
  it('reports what cannot be loaded', () => expect(platesPerSide(21)).toEqual({ plates: [], remainderKg: 1 }))
  it('empty bar', () => expect(platesPerSide(20).plates).toEqual([]))
})
