import { describe, expect, it } from 'vitest'
import type { BodyComp, Session, SetLog, StoredPlan } from '../../db/db'
import { WHY } from '../coach/why'
import { planReport, planWindow, type ReportInput } from './planReport'

const DAY = 86_400_000
const T0 = new Date(2026, 6, 6).getTime() // plan created
const plan = (over: Partial<StoredPlan> = {}): StoredPlan => ({
  id: 'p', name: 'Block', splitName: 'Full body ×3', createdAt: T0, schedule: { daysPerWeek: 3, sessionMinutes: 60, weeks: 8 }, priorities: [],
  days: [0, 1, 2].map((i) => ({ name: `D${i}`, estMinutes: 60, items: [{ exerciseId: i === 1 ? 'barbell_bench_press' : 'barbell_back_squat', role: 'main', target: { sets: 3, repMin: 5, repMax: 8, targetRpe: 8, restSec: 120 }, reason: '', alternatives: [] }] })),
  weeklySets: {}, notes: [], ...over,
})
let n = 0
/** `count` plan workouts spread over the 8 weeks, squat and bench rising by `gainPct` from first to last. */
function training(count: number, gainPct: number) {
  const sessions: Session[] = [], sets: SetLog[] = []
  for (let i = 0; i < count; i++) {
    const t = T0 + (i / Math.max(1, count - 1)) * 54 * DAY + DAY
    const id = `s${n++}`
    sessions.push({ id, startedAt: t, endedAt: t + 3600e3, entries: [], planId: 'p', dayIndex: i % 3 })
    const k = 1 + (gainPct / 100) * (i / Math.max(1, count - 1))
    for (const [ex, kg] of [['barbell_back_squat', 100], ['barbell_bench_press', 80]] as const) {
      sets.push({ id: `${id}${ex}`, sessionId: id, entryKey: ex, exerciseId: ex, kind: 'working', weightKg: kg * k, reps: 5, completedAt: t })
    }
  }
  return { sessions, sets }
}
const comp = (day: number, values: BodyComp['values']): BodyComp => ({ id: `c${day}`, measuredAt: T0 + day * DAY, values, source: 'manual', createdAt: 0 })
const input = (over: Partial<ReportInput>): ReportInput => ({ plan: plan(), goal: 'hypertrophy', ...training(24, 6), comps: [], scans: [], goals: [], now: T0 + 60 * DAY, ...over })

describe('planWindow', () => {
  it('8 weeks from creation; week number while running', () => {
    expect(planWindow(plan(), T0 + 17 * DAY)).toMatchObject({ weeks: 8, finished: false, week: 3 })
    expect(planWindow(plan(), T0 + 57 * DAY).finished).toBe(true)
  })
  it('finishing early ends the window that day', () => {
    const w = planWindow(plan({ finishedAt: T0 + 30 * DAY }), T0 + 31 * DAY)
    expect(w).toMatchObject({ finished: true, end: T0 + 30 * DAY })
  })
  it('defaults to 8 weeks for older plans', () => {
    expect(planWindow(plan({ schedule: { daysPerWeek: 3, sessionMinutes: 60 } }), T0).weeks).toBe(8)
  })
})

describe('verdicts', () => {
  it('build muscle: +0.6 kg skeletal muscle on InBody → reached', () => {
    const r = planReport(input({ comps: [comp(-3, { smmKg: 33.0, pbf: 18 }), comp(55, { smmKg: 33.6, pbf: 17.4 })] }))
    expect(r.verdict).toBe('reached')
    expect(r.basis).toMatch(/Skeletal muscle \+0\.6 kg/)
    expect(r.body.map((b) => b.label)).toEqual(['Skeletal muscle', 'Body fat'])
  })
  it('build muscle without InBody falls back to strength', () => {
    const r = planReport(input({ ...training(24, 2) }))
    expect(r.verdict).toBe('partly')
    expect(r.basis).toMatch(/judged by strength/)
  })
  it('lose fat: −1.4 points → reached; +0.2 → not reached; no InBody → no data', () => {
    expect(planReport(input({ goal: 'fat_loss', comps: [comp(0, { pbf: 22 }), comp(56, { pbf: 20.6 })] })).verdict).toBe('reached')
    expect(planReport(input({ goal: 'fat_loss', comps: [comp(0, { pbf: 22 }), comp(56, { pbf: 22.2 })] })).verdict).toBe('not_reached')
    expect(planReport(input({ goal: 'fat_loss' })).verdict).toBe('no_data')
  })
  it('strength: main lifts +6% → reached, with per-lift detail', () => {
    const r = planReport(input({ goal: 'strength' }))
    expect(r.verdict).toBe('reached')
    expect(r.lifts.map((l) => l.exerciseId).sort()).toEqual(['barbell_back_squat', 'barbell_bench_press'])
    expect(r.avgLiftPct).toBeCloseTo(6, 0)
  })
  it('general fitness: by adherence (12 of 24 = 50% → partly)', () => {
    const r = planReport(input({ goal: 'general', ...training(12, 0) }))
    expect(r.workouts).toMatchObject({ done: 12, planned: 24 })
    expect(r.verdict).toBe('partly')
  })
  it('athletic: strength up 3%+ with 70%+ of sessions', () => {
    expect(planReport(input({ goal: 'athletic', ...training(20, 4) })).verdict).toBe('reached')
    expect(planReport(input({ goal: 'athletic', ...training(8, 4) })).verdict).toBe('partly')
  })
  it('nothing logged → no data', () => {
    expect(planReport(input({ goal: 'strength', sessions: [], sets: [] })).verdict).toBe('no_data')
  })
  it('every verdict explains itself', () => {
    for (const g of ['hypertrophy', 'fat_loss', 'strength', 'athletic', 'general'] as const) expect(WHY[planReport(input({ goal: g })).why]).toBeDefined()
  })
})

describe('extras', () => {
  it('InBody: the result nearest the start (±14 days) and the last by the end, at least a week apart', () => {
    const r = planReport(input({ comps: [comp(-40, { smmKg: 30 }), comp(10, { smmKg: 33 }), comp(30, { smmKg: 33.2 }), comp(66, { smmKg: 33.5 }), comp(90, { smmKg: 40 })] }))
    expect(r.body[0]).toMatchObject({ before: 33, after: 33.5 })
  })
  it('posture: findings first vs last scan', () => {
    const r = planReport(input({ scans: [{ takenAt: T0 + DAY, findings: 3 }, { takenAt: T0 + 50 * DAY, findings: 1 }] }))
    expect(r.posture).toEqual({ before: 3, after: 1 })
  })
  it('goals reached during the plan', () => {
    const r = planReport(input({ goals: [{ title: 'Bench: 100 kg', achievedAt: T0 + 40 * DAY }, { title: 'Old', achievedAt: T0 - 5 * DAY }] }))
    expect(r.goalsReached).toEqual(['Bench: 100 kg'])
  })
})
