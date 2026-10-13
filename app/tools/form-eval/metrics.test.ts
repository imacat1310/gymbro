// The evaluator itself is tested with synthetic sets whose truth is known by construction.
import { describe, expect, it } from 'vitest'
import { squatRecording } from '../../src/lib/fixtures/squat'
import { makeSample, type FormSample, type SampleLabels } from '../../src/lib/form/sample'
import { DEFAULT_SQUAT_THRESHOLDS } from '../../src/lib/form/squat'
import { EMPTY_PROFILE } from '../../src/lib/form/types'
import { evaluate, sweep } from './metrics'

const sample = (spec: Parameters<typeof squatRecording>[0], labels?: SampleLabels): FormSample =>
  makeSample(squatRecording(spec), EMPTY_PROFILE, null, labels, 'test')
const perRep = (n: number, faults: ('shallow' | 'knee_cave')[] = []) => ({ perRep: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, faults])) })

describe('evaluate', () => {
  it('perfect agreement → F1 1 and exact rep counts', () => {
    const e = evaluate([
      sample({ view: 'side', reps: 3, depthDeg: -22 }, perRep(3, ['shallow'])),
      sample({ view: 'side', reps: 3, depthDeg: 6 }, perRep(3)),
    ])
    expect(e.faults.shallow).toMatchObject({ tp: 3, fp: 0, fn: 0, tn: 3, f1: 1 })
    expect(e.repCount).toMatchObject({ samples: 2, exact: 2, meanAbsError: 0 })
  })

  it('counts misses and false alarms', () => {
    const e = evaluate([
      sample({ view: 'side', reps: 2, depthDeg: 6 }, perRep(2, ['shallow'])), // labelled shallow, looks fine → misses
      sample({ view: 'side', reps: 2, depthDeg: -22 }, perRep(2)), // labelled good, looks shallow → false alarms
    ])
    expect(e.faults.shallow).toMatchObject({ tp: 0, fp: 2, fn: 2, tn: 0, f1: 0 })
  })

  it('clip-level labels, true rep counts and unusable samples', () => {
    const e = evaluate([
      sample({ view: 'front', reps: 3, caveDeg: { left: 16, right: 0 } }, { clip: ['knee_cave'], reps: 4 }),
      sample({ view: 'side', visibility: 0.2 }, { clip: [] }),
      sample({ view: 'side', reps: 2 }),
    ])
    expect(e.faults.knee_cave).toMatchObject({ tp: 1, fn: 0 })
    expect(e.repCount).toMatchObject({ samples: 1, exact: 0, meanAbsError: 1 })
    expect(e.unusable).toBe(1)
    expect(e.labelled).toBe(1)
  })
})

describe('sweep', () => {
  it('finds a better shallow threshold when labels say a slightly high squat is fine', () => {
    // These users call −10° "good enough"; the current −5° limit flags it. Deep fails are −25°.
    const samples = [
      ...Array.from({ length: 3 }, () => sample({ view: 'side', reps: 3, depthDeg: -10 }, perRep(3))),
      ...Array.from({ length: 3 }, () => sample({ view: 'side', reps: 3, depthDeg: -25 }, perRep(3, ['shallow']))),
    ]
    const r = sweep(samples).find((x) => x.fault === 'shallow')!
    expect(r.current).toBe(DEFAULT_SQUAT_THRESHOLDS.shallow.mild)
    expect(r.currentF1).toBeLessThan(1)
    expect(r.bestF1).toBe(1)
    expect(r.best).toBeLessThanOrEqual(-10) // measured depth sits just above −10, so −10 itself separates them
    expect(r.best).toBeGreaterThan(-25)
    expect(r.enoughData).toBe(true)
  })

  it('keeps the current value when it is already best, and flags thin data', () => {
    const r = sweep([
      sample({ view: 'side', reps: 2, depthDeg: -25 }, perRep(2, ['shallow'])),
      sample({ view: 'side', reps: 2, depthDeg: 6 }, perRep(2)),
    ]).find((x) => x.fault === 'shallow')!
    expect(r.best).toBe(r.current)
    expect(r.enoughData).toBe(false)
  })
})
