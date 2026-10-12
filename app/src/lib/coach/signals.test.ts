import { describe, expect, it } from 'vitest'
import type { Session, SetLog, StoredPlan } from '../../db/db'
import { coachView, deriveSignals, isStalled, selectInsight, weekStart, type Signals } from './signals'
import { WHY } from './why'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 14, 12).getTime() // a Wednesday

let n = 0
/** One finished session doing `lifts` (exerciseId → [weight, reps]) `daysAgo` days before NOW. */
function session(daysAgo: number, lifts: Record<string, [number, number]>): { s: Session; sets: SetLog[] } {
  const id = `s${n++}`
  const t = NOW - daysAgo * DAY
  const sets = Object.entries(lifts).flatMap(([exerciseId, [w, r]]) => [0, 1, 2].map((i) => ({
    id: `${id}-${exerciseId}-${i}`, sessionId: id, entryKey: exerciseId, exerciseId, kind: 'working' as const, weightKg: w, reps: r, completedAt: t + i,
  })))
  return { s: { id, startedAt: t, endedAt: t + 3600_000, entries: [] }, sets }
}
function signals(list: ReturnType<typeof session>[], extra: Partial<Parameters<typeof deriveSignals>[0]> = {}) {
  return deriveSignals({ sessions: list.map((x) => x.s), sets: list.flatMap((x) => x.sets), now: NOW, ...extra })
}
const plan3 = { days: [{}, {}, {}], bodyDataAt: 0 } as unknown as StoredPlan

describe('isStalled (adapted from gymcoach)', () => {
  it('needs enough sessions', () => expect(isStalled([100, 100])).toBe(false))
  it('flat for 3 sessions → stalled', () => expect(isStalled([100, 104, 104, 103.9, 104.2])).toBe(true))
  it('a gain above 0.5% in the window → not stalled', () => expect(isStalled([100, 104, 104, 105])).toBe(false))
  it('rounding noise (≤ 0.5%) is not progress', () => expect(isStalled([100, 100, 100.4, 100.3])).toBe(true))
})

describe('deriveSignals', () => {
  it('two stalled lifts → deload recommended; a progressing lift is not stalled', () => {
    const s = signals([
      session(20, { barbell_back_squat: [100, 5], barbell_bench_press: [80, 5], barbell_row: [60, 8] }),
      session(15, { barbell_back_squat: [100, 5], barbell_bench_press: [80, 5], barbell_row: [62.5, 8] }),
      session(10, { barbell_back_squat: [100, 5], barbell_bench_press: [80, 5], barbell_row: [65, 8] }),
      session(5, { barbell_back_squat: [100, 5], barbell_bench_press: [80, 5], barbell_row: [67.5, 8] }),
    ])
    expect(s.stalled.sort()).toEqual(['barbell_back_squat', 'barbell_bench_press'])
    expect(s.deloadRecommended).toBe(true)
  })
  it('lifts not trained for 6+ weeks are not judged', () => {
    const s = signals([50, 48, 46, 45].map((d) => session(d, { barbell_back_squat: [100, 5] })))
    expect(s.stalled).toEqual([])
  })
  it('records from the latest session (within 3 days)', () => {
    const s = signals([session(7, { barbell_back_squat: [100, 5] }), session(1, { barbell_back_squat: [105, 5] })])
    expect(s.lastRecords.map((r) => r.kind).sort()).toEqual(['e1rm', 'weight'])
  })
  it('sessions this week count from Monday', () => {
    const monday = weekStart(NOW)
    expect(new Date(monday).getDay()).toBe(1)
    const s = signals([session(1, { goblet_squat: [20, 10] }), session(4, { goblet_squat: [20, 10] })], { plan: plan3 })
    expect(s.sessionsThisWeek).toBe(1) // 4 days before Wednesday is last week
    expect(s.planDays).toBe(3)
  })
})

describe('selectInsight: priority', () => {
  const base: Signals = { stalled: [], deloadRecommended: false, sessionsThisWeek: 1, planDays: 3, lastRecords: [], newBodyData: false, bodySources: [], weeksOfHistory: 2, exercisesTracked: 4, goalsReached: [], goalsActive: 0, goalsDone: 0 }
  it('safety pause beats everything', () => {
    expect(selectInsight({ ...base, pause: 'x', deloadRecommended: true, stalled: ['a', 'b'] })!.kind).toBe('pause')
  })
  it('deload > stall > record > rebuild > consistency', () => {
    expect(selectInsight({ ...base, deloadRecommended: true, stalled: ['barbell_back_squat', 'barbell_row'] })!.kind).toBe('deload')
    expect(selectInsight({ ...base, stalled: ['barbell_back_squat'], lastRecords: [{ exerciseId: 'barbell_row', kind: 'weight' }] })!.kind).toBe('stall')
    expect(selectInsight({ ...base, lastRecords: [{ exerciseId: 'barbell_row', kind: 'weight' }], newBodyData: true })!.kind).toBe('record')
    expect(selectInsight({ ...base, newBodyData: true, bodySources: ['InBody (1 Oct)'] })!.kind).toBe('rebuild')
    expect(selectInsight(base)!.kind).toBe('behind')
    expect(selectInsight({ ...base, sessionsThisWeek: 3 })!.kind).toBe('on_track')
  })
  it('a goal reached in the last days beats a stall, but not a deload', () => {
    expect(selectInsight({ ...base, goalsReached: [{ title: 'Bench press: 100 kg', kind: 'lift' }], stalled: ['barbell_row'] })!).toMatchObject({ kind: 'goal', why: 'goal_lift' })
    expect(selectInsight({ ...base, goalsReached: [{ title: 'Body fat: 15%', kind: 'body' }], deloadRecommended: true, stalled: ['a', 'b'] })!.kind).toBe('deload')
  })
  it('nothing to say without a plan or history', () => {
    expect(selectInsight({ ...base, planDays: null })).toBeNull()
  })
  it('every insight points to a rule in the why registry', () => {
    for (const s of [{ ...base, pause: 'x' }, { ...base, deloadRecommended: true, stalled: ['a', 'b'] }, base]) {
      expect(WHY[selectInsight(s)!.why]).toBeDefined()
    }
  })
  it('coach view lists the signals in plain lines', () => {
    const lines = coachView({ ...base, stalled: ['barbell_back_squat'] })
    expect(lines).toContain('Stalled: Barbell back squat')
    expect(lines).toHaveLength(8)
  })
})
