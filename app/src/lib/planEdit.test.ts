import { describe, expect, it } from 'vitest'
import { GYM_PRESETS } from '../data/equipment'
import {
  addDay, addItem, checkPlan, moveDay, moveItem, removeDay, removeItem, renameDay, updateTarget, type CheckContext,
} from './planEdit'
import { buildPlan, estimateMinutes, type PlanDay } from './planner'
import type { Profile } from './targets'

const profile: Profile = { goal: 'hypertrophy', experience: 'intermediate', intensity: 'moderate' }
const commercial = GYM_PRESETS.find((p) => p.id === 'commercial')!.equipment
const plan = buildPlan({ profile, daysPerWeek: 3, sessionMinutes: 60, equipment: commercial, limitations: [], priorities: [] })
const ctx: CheckContext = { profile, limitations: [], priorities: [], sessionMinutes: 60, edited: true }
const ids = (d: PlanDay) => d.items.map((i) => i.exerciseId)

describe('plan edits', () => {
  it('add item uses default targets and updates minutes', () => {
    const days = addItem(plan.days, 0, 'db_curl', profile)
    expect(ids(days[0]).at(-1)).toBe('db_curl')
    expect(days[0].items.at(-1)!.reason).toBe('Added by you')
    expect(days[0].estMinutes).toBe(estimateMinutes(days[0].items))
    expect(days[0].estMinutes).toBeGreaterThan(plan.days[0].estMinutes)
    expect(plan.days[0].items.some((i) => i.exerciseId === 'db_curl' && i.reason === 'Added by you')).toBe(false) // input untouched
  })
  it('unknown exercise is ignored', () => {
    expect(addItem(plan.days, 0, 'nope', profile)).toBe(plan.days)
  })
  it('remove and move items', () => {
    const [a, b] = ids(plan.days[0])
    expect(ids(removeItem(plan.days, 0, 0)[0])[0]).toBe(b)
    const moved = moveItem(plan.days, 0, 0, 1)
    expect(ids(moved[0]).slice(0, 2)).toEqual([b, a])
    expect(moveItem(plan.days, 0, 0, -1)[0].items[0].exerciseId).toBe(a) // can't move past the top
  })
  it('target updates are clamped and keep repMin ≤ repMax', () => {
    const t = (patch: Parameters<typeof updateTarget>[3]) => updateTarget(plan.days, 0, 0, patch)[0].items[0].target
    expect(t({ sets: 0 }).sets).toBe(1)
    expect(t({ sets: 99 }).sets).toBe(10)
    const up = t({ repMin: 20 })
    expect(up.repMin).toBe(20)
    expect(up.repMax).toBe(20)
    const down = t({ repMax: 2 })
    expect(down.repMin).toBe(2)
    expect(t({ restSec: -5 }).restSec).toBe(0)
  })
  it('days: add (max 7), rename, move, remove', () => {
    let days = addDay(plan.days)
    expect(days).toHaveLength(4)
    expect(days[3]).toMatchObject({ name: 'Day 4', items: [] })
    days = renameDay(days, 3, 'Arms')
    expect(days[3].name).toBe('Arms')
    days = moveDay(days, 3, -1)
    expect(days[2].name).toBe('Arms')
    expect(removeDay(days, 2).map((d) => d.name)).not.toContain('Arms')
    let many = plan.days
    for (let i = 0; i < 10; i++) many = addDay(many)
    expect(many).toHaveLength(7)
  })
})

describe('checkPlan', () => {
  it('a generated plan has no warnings', () => {
    expect(checkPlan(plan.days, { ...ctx, edited: false })).toEqual([])
  })

  it('injury conflict is a danger warning on the exercise, even on unedited plans', () => {
    const days = addItem(plan.days, 0, 'barbell_deadlift', profile)
    const w = checkPlan(days, { ...ctx, limitations: ['lower_back'], edited: false })
    const hit = w.find((x) => x.level === 'danger' && x.itemIndex === days[0].items.length - 1)
    expect(hit?.text).toMatch(/Deadlift loads your lower back/i)
  })

  it('empty day and over-long day warn', () => {
    const empty = checkPlan(addDay(plan.days), ctx)
    expect(empty.some((w) => w.dayIndex === 3 && /no exercises/.test(w.text))).toBe(true)
    let long = plan.days
    for (const id of ['db_curl', 'cable_curl', 'triceps_pushdown', 'db_lateral_raise', 'lying_leg_curl', 'calf_raise_machine']) long = addItem(long, 0, id, profile)
    expect(checkPlan(long, ctx).some((w) => w.dayIndex === 0 && /more than your 60 min/.test(w.text))).toBe(true)
  })

  it('removing all chest work warns about chest', () => {
    let days = plan.days
    for (let d = 0; d < days.length; d++) {
      days = days.map((day, i) => (i === d ? { ...day, items: day.items.filter((it) => !['barbell_bench_press', 'incline_db_press', 'db_bench_press', 'incline_barbell_bench', 'machine_chest_press', 'push_up', 'dip', 'cable_fly', 'db_fly', 'pec_deck'].includes(it.exerciseId)) } : day))
    }
    expect(checkPlan(days, ctx).some((w) => w.text.startsWith('Chest'))).toBe(true)
  })

  it('more push than pull warns', () => {
    let days = plan.days
    for (let i = 0; i < 4; i++) days = addItem(days, i % days.length, 'barbell_bench_press', profile)
    expect(checkPlan(days, ctx).some((w) => /More pushing/.test(w.text))).toBe(true)
  })

  it('volume checks are skipped on unedited plans', () => {
    expect(checkPlan(addDay(plan.days), { ...ctx, edited: false })).toEqual([])
  })

  it('exercises the gym can’t do are flagged as info', () => {
    const home = GYM_PRESETS.find((p) => p.id === 'bodyweight')!.equipment
    const w = checkPlan(plan.days, { ...ctx, edited: false, equipment: home, gymName: 'Home' })
    expect(w.length).toBeGreaterThan(0)
    expect(w.every((x) => x.level === 'info' && /isn't possible at Home/.test(x.text))).toBe(true)
  })
})
