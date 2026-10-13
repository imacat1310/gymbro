import { describe, expect, it } from 'vitest'
import { formHold, type CheckSummary } from './hold'

const H = 3600_000
const check = (takenAt: number, blockIncrease?: string, score = 55): CheckSummary => ({
  takenAt, report: { blockIncrease, score, faults: blockIncrease ? [{ code: 'forward_lean', severity: 'moderate', reps: [1], value: 60, unit: '°', tip: 't' }] : [] },
})

describe('formHold', () => {
  const lastSession = 100 * H
  it('holds after a check in the last workout that said keep the weight', () => {
    expect(formHold([check(lastSession + 0.5 * H, 'x')], lastSession)).toMatch(/scored 55\/100 \(torso lean\)/)
  })
  it('counts a warm-up check made shortly before the first logged set', () => {
    expect(formHold([check(lastSession - 1 * H, 'x')], lastSession)).toBeDefined()
  })
  it('no hold when the newest check was fine, or is older than the last workout', () => {
    expect(formHold([check(lastSession + H, 'x'), check(lastSession + 2 * H)], lastSession)).toBeUndefined()
    expect(formHold([check(lastSession - 5 * H, 'x')], lastSession)).toBeUndefined()
  })
  it('no history or no checks → no hold', () => {
    expect(formHold([check(1, 'x')], undefined)).toBeUndefined()
    expect(formHold([], lastSession)).toBeUndefined()
  })
})
