import { describe, expect, it } from 'vitest'
import type { Session, SetLog } from '../../db/db'
import { WHY } from '../coach/why'
import { computeProgress, levelFor, xpForLevel } from './level'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 14, 18).getTime() // Wednesday evening

let n = 0
/** A finished 60-min workout `daysAgo` days ago with 3 working sets per lift. */
function w(daysAgo: number, lifts: Record<string, [number, number]> = { goblet_squat: [20, 10] }) {
  const id = `w${n++}`
  const t = NOW - daysAgo * DAY
  const sets: SetLog[] = Object.entries(lifts).flatMap(([ex, [kg, reps]]) => [0, 1, 2].map((i) => ({
    id: `${id}-${ex}-${i}`, sessionId: id, entryKey: ex, exerciseId: ex, kind: 'working' as const, weightKg: kg, reps, completedAt: t + i,
  })))
  return { s: { id, startedAt: t, endedAt: t + 3_600_000, entries: [] } as Session, sets }
}
const run = (ws: ReturnType<typeof w>[], extra: Partial<Parameters<typeof computeProgress>[0]> = {}) =>
  computeProgress({ sessions: ws.map((x) => x.s), sets: ws.flatMap((x) => x.sets), now: NOW, ...extra })

describe('levels', () => {
  it('curve: 0, 100, 300, 600, 1000 …', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000])
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(299).level).toBe(2)
    expect(levelFor(300)).toEqual({ level: 3, floor: 300, next: 600 })
  })
})

describe('computeProgress', () => {
  it('nothing logged → level 1, no stats, first badge locked', () => {
    const p = run([])
    expect(p).toMatchObject({ xp: 0, level: 1 })
    expect(p.stats.every((s) => s.value === null)).toBe(true)
    expect(p.badges.find((b) => b.id === 'first_workout')!.unlocked).toBe(false)
  })

  it('XP: 100 per workout + 2 per set + 50 per record (one per exercise per workout)', () => {
    const p = run([w(10, { barbell_back_squat: [100, 5] }), w(3, { barbell_back_squat: [105, 5] })])
    // 2 workouts × (100 + 3 sets × 2) + 1 record × 50 (heavier weight and higher e1RM count once)
    expect(p.xp).toBe(2 * 106 + 50)
    expect(p.totals.records).toBe(1)
    expect(p.badges.find((b) => b.id === 'first_record')!.unlocked).toBe(true)
  })

  it('unfinished sessions and sessions without working sets don\'t count', () => {
    const a = w(2); a.s.endedAt = undefined
    const b = w(1); b.sets = []
    expect(run([a, b]).totals.workouts).toBe(0)
  })

  it('this week: workouts and minutes against the plan', () => {
    const p = run([w(0), w(1), w(5)], { planDays: 3, sessionMinutes: 45 })
    expect(p.week).toEqual({ workouts: 2, targetWorkouts: 3, minutes: 120, targetMinutes: 135 })
  })

  it('streak: consecutive weeks hitting the plan, with XP and badges', () => {
    // Four past weeks with 3 workouts each (Mon/Tue/Wed of each week, relative to this Wednesday).
    const ws = [1, 2, 3, 4].flatMap((k) => [k * 7, k * 7 + 1, k * 7 + 2].map((d) => w(d)))
    const p = run(ws, { planDays: 3 })
    expect(p.streakWeeks).toBe(4)
    expect(p.badges.find((b) => b.id === 'streak_4')!.unlocked).toBe(true)
    expect(p.xp).toBe(12 * 106 + 4 * 150)
  })

  it('strength is relative to bodyweight', () => {
    const lifts = { barbell_back_squat: [100, 1], barbell_deadlift: [140, 1], barbell_bench_press: [80, 1] } as Record<string, [number, number]>
    const light = run([w(2, lifts)], { bodyweightKg: 64 }).stats.find((s) => s.key === 'strength')!
    const heavy = run([w(2, lifts)], { bodyweightKg: 128 }).stats.find((s) => s.key === 'strength')!
    expect(light.value).toBe(99) // 320 / 64 = 5× bodyweight
    expect(heavy.value).toBe(50)
  })

  it('power counts sessions with jumps or throws', () => {
    const p = run([w(2, { box_jump: [0, 5] }), w(5, { squat_jump: [0, 5] })])
    expect(p.stats.find((s) => s.key === 'power')!.value).toBe(24)
  })

  it('balance: null without body data; drops with findings, trunk and weak sides', () => {
    expect(run([w(1)]).stats.find((s) => s.key === 'balance')!.value).toBeNull()
    const b = run([w(1)], { balance: { findings: [{ severity: 'moderate' }], trunk: 'borderline', weakSides: 1 } }).stats.find((s) => s.key === 'balance')!
    expect(b.value).toBe(99 - 20 - 15 - 10)
    expect(run([w(1)], { balance: { findings: [], weakSides: 0 } }).badges.find((x) => x.id === 'balanced')!.unlocked).toBe(true)
  })

  it('badge dates: when the threshold was first reached', () => {
    const ws = Array.from({ length: 10 }, (_, i) => w(40 - i * 3))
    const p = run(ws)
    expect(p.badges.find((b) => b.id === 'workouts_10')!.at).toBe(ws[9].s.startedAt)
    expect(p.badges.find((b) => b.id === 'workouts_50')!.progress).toBe('10 / 50')
  })

  it('every stat explains itself in the Why registry', () => {
    for (const s of run([w(1)]).stats) expect(WHY[s.why]).toBeDefined()
  })
})
