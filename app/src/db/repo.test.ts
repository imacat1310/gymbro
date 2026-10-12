// Data-layer tests against an in-memory IndexedDB (fake-indexeddb).
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { GYM_PRESETS } from '../data/equipment'
import { db } from './db'
import {
  buildAndSavePlan, completeOnboarding, DEFAULT_PROFILE, duplicatePlan, exportAll, finishPlan, getActivePlan,
  importAll, ImportError, logSet, resetAll, saveSettings, startSession, swapPlanExercise,
} from './repo'

const COMMERCIAL = GYM_PRESETS.find((p) => p.id === 'commercial')!.equipment
const PREFS = { name: 'Test plan', schedule: { daysPerWeek: 3, sessionMinutes: 60 }, priorities: [] }

beforeEach(async () => {
  await db.delete()
  await db.open()
  await completeOnboarding(DEFAULT_PROFILE, 'Gym', COMMERCIAL)
})

const activeSessions = () => db.sessions.filter((s) => !s.endedAt).count()

describe('startSession', () => {
  it('a double tap creates one workout, not two', async () => {
    const plan = await buildAndSavePlan(PREFS)
    const ids = await Promise.all([
      startSession({ plan, dayIndex: 0 }),
      startSession({ plan, dayIndex: 0 }),
      startSession(),
    ])
    expect(new Set(ids).size).toBe(1)
    expect(await activeSessions()).toBe(1)
  })

  it('returns the workout already in progress', async () => {
    const first = await startSession()
    expect(await startSession()).toBe(first)
  })
})

describe('plans', () => {
  it('duplicating a finished plan gives a fresh, unfinished, active copy', async () => {
    const plan = await buildAndSavePlan(PREFS)
    await finishPlan(plan.id)
    const copy = (await duplicatePlan(plan.id))!
    expect(copy.finishedAt).toBeUndefined()
    expect(copy.id).not.toBe(plan.id)
    expect((await getActivePlan())?.id).toBe(copy.id)
    expect((await db.plans.get(plan.id))?.finishedAt).toBeDefined()
  })

  it('rebuilding in place keeps a finished plan finished and its original goal', async () => {
    const plan = await buildAndSavePlan(PREFS)
    await finishPlan(plan.id)
    const finishedAt = (await db.plans.get(plan.id))!.finishedAt
    await saveSettings({ profile: { ...DEFAULT_PROFILE, goal: 'strength' } })
    const rebuilt = await buildAndSavePlan(PREFS, plan.id)
    expect(rebuilt.finishedAt).toBe(finishedAt)
    expect(rebuilt.goal).toBe(DEFAULT_PROFILE.goal)
  })

  it('a swap marks the plan as hand-edited and refreshes its stats', async () => {
    const plan = await buildAndSavePlan(PREFS)
    const item = plan.days[0].items[0]
    const alt = item.alternatives[0]
    await swapPlanExercise(plan.id, 0, 0, alt)
    const after = (await db.plans.get(plan.id))!
    expect(after.days[0].items[0].exerciseId).toBe(alt)
    expect(after.edited).toBe(true)
    expect(after.updatedAt).toBeGreaterThanOrEqual(plan.updatedAt ?? 0)
    expect(after.days[0].estMinutes).toBeGreaterThan(0)
    expect(after.weeklySets).not.toEqual({})
  })
})

describe('backup', () => {
  async function seed() {
    const id = await startSession()
    await logSet({ sessionId: id, entryKey: 'k', exerciseId: 'barbell_bench_press', kind: 'working', weightKg: 60, reps: 8 })
    await logSet({ sessionId: id, entryKey: 'k', exerciseId: 'barbell_bench_press', kind: 'working', weightKg: 60, reps: 7 })
  }

  it('exports every table', async () => {
    const data = await exportAll()
    for (const t of db.tables) expect(data, t.name).toHaveProperty(t.name)
    expect(data.version).toBe(db.verno)
  })

  it('round-trips: export → delete all → import restores everything', async () => {
    await seed()
    const before = await exportAll()
    await resetAll()
    expect(await db.sets.count()).toBe(0)
    const result = await importAll(JSON.parse(JSON.stringify(before)))
    expect(result).toEqual({ sessions: 1, sets: 2 })
    const after = await exportAll()
    for (const t of db.tables) expect(after[t.name as keyof typeof after], t.name).toEqual(before[t.name as keyof typeof before])
  })

  it('refuses files that are not GymBro backups, or from a newer version', async () => {
    await expect(importAll({ hello: 1 })).rejects.toBeInstanceOf(ImportError)
    await expect(importAll(null)).rejects.toBeInstanceOf(ImportError)
    await expect(importAll({ app: 'gymbro', version: db.verno + 1 })).rejects.toThrow(/newer version/)
    await expect(importAll({ app: 'gymbro', version: db.verno, sets: 'oops' })).rejects.toThrow(/damaged/)
  })

  it('a failed import changes nothing', async () => {
    await seed()
    const before = await db.sets.count()
    // Duplicate primary keys make bulkAdd fail halfway through the transaction.
    const bad = { ...(await exportAll()), sets: [{ id: 'dup' }, { id: 'dup' }] }
    await expect(importAll(bad)).rejects.toThrow()
    expect(await db.sets.count()).toBe(before)
    expect(await db.gyms.count()).toBe(1)
  })

  it('delete all clears every table', async () => {
    await seed()
    await resetAll()
    for (const t of db.tables) expect(await t.count(), t.name).toBe(0)
  })
})
