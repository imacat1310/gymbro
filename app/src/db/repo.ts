// Data access helpers. Components read through useLiveQuery and write through these functions.
import { EXERCISE_BY_ID } from '../data/exercises'
import type { LoggedSet } from '../lib/progression'
import { defaultTarget, type Profile } from '../lib/targets'
import { db, uid, type Gym, type SetKind, type SetLog, type Settings } from './db'

export const DEFAULT_PROFILE: Profile = { goal: 'hypertrophy', experience: 'beginner', intensity: 'moderate' }

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('me')) ?? { id: 'me', profile: DEFAULT_PROFILE, onboarded: false }
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>) {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch })
}

export async function createGym(name: string, equipment: string[]): Promise<Gym> {
  const gym: Gym = { id: uid(), name, equipment, createdAt: Date.now() }
  await db.gyms.add(gym)
  return gym
}

export async function completeOnboarding(profile: Profile, gymName: string, equipment: string[]) {
  await db.transaction('rw', db.gyms, db.settings, async () => {
    const gym = await createGym(gymName, equipment)
    await db.settings.put({ id: 'me', profile, activeGymId: gym.id, onboarded: true })
  })
}

export async function deleteGym(id: string) {
  await db.transaction('rw', db.gyms, db.settings, async () => {
    await db.gyms.delete(id)
    const s = await getSettings()
    if (s.activeGymId === id) {
      const next = await db.gyms.toCollection().first()
      await db.settings.put({ ...s, activeGymId: next?.id })
    }
  })
}

export async function getActiveSession() {
  return db.sessions.orderBy('startedAt').reverse().filter((s) => !s.endedAt).first()
}

export async function startSession(): Promise<string> {
  const active = await getActiveSession()
  if (active) return active.id
  const s = await getSettings()
  const id = uid()
  await db.sessions.add({ id, gymId: s.activeGymId, startedAt: Date.now(), entries: [] })
  return id
}

export async function addEntry(sessionId: string, exerciseId: string) {
  const ex = EXERCISE_BY_ID.get(exerciseId)
  if (!ex) return
  const { profile } = await getSettings()
  const session = await db.sessions.get(sessionId)
  if (!session) return
  await db.sessions.update(sessionId, {
    entries: [...session.entries, { key: uid(), exerciseId, target: defaultTarget(ex, profile) }],
  })
}

export async function removeEntry(sessionId: string, key: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) return
    await db.sessions.update(sessionId, { entries: session.entries.filter((e) => e.key !== key) })
    await db.sets.where('sessionId').equals(sessionId).filter((s) => s.entryKey === key).delete()
  })
}

export async function logSet(input: Omit<SetLog, 'id' | 'completedAt'>) {
  await db.sets.add({ ...input, id: uid(), completedAt: Date.now() })
}

export async function deleteSet(id: string) {
  await db.sets.delete(id)
}

export async function startRest(sessionId: string, seconds: number) {
  await db.sessions.update(sessionId, { restEndsAt: Date.now() + seconds * 1000, restTotalSec: seconds })
}

export async function extendRest(sessionId: string, seconds: number) {
  const s = await db.sessions.get(sessionId)
  if (!s?.restEndsAt) return
  await db.sessions.update(sessionId, { restEndsAt: s.restEndsAt + seconds * 1000, restTotalSec: (s.restTotalSec ?? 0) + seconds })
}

/** Clear the rest timer. With `onlyIfEndsAt`, only clear that specific rest (a newer one is left alone). */
export async function clearRest(sessionId: string, onlyIfEndsAt?: number) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId)
    if (!s || (onlyIfEndsAt !== undefined && s.restEndsAt !== onlyIfEndsAt)) return
    await db.sessions.update(sessionId, { restEndsAt: undefined, restTotalSec: undefined })
  })
}

export async function finishSession(sessionId: string) {
  await db.sessions.update(sessionId, { endedAt: Date.now(), restEndsAt: undefined, restTotalSec: undefined })
}

export async function discardSession(sessionId: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/** Working sets for an exercise grouped per session, most recent session first. */
export async function exerciseHistory(exerciseId: string, excludeSessionId?: string): Promise<{ sessionId: string; date: number; sets: SetLog[] }[]> {
  const rows = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const bySession = new Map<string, SetLog[]>()
  for (const r of rows) {
    if (r.kind !== 'working' || r.sessionId === excludeSessionId) continue
    const list = bySession.get(r.sessionId) ?? []
    list.push(r)
    bySession.set(r.sessionId, list)
  }
  return [...bySession.entries()]
    .map(([sessionId, sets]) => ({
      sessionId,
      date: Math.min(...sets.map((s) => s.completedAt)),
      sets: sets.sort((a, b) => a.completedAt - b.completedAt),
    }))
    .sort((a, b) => b.date - a.date)
}

export const toLogged = (s: SetLog): LoggedSet => ({ weightKg: s.weightKg, reps: s.reps, rpe: s.rpe })

export async function exportAll() {
  const [gyms, settings, sessions, sets] = await Promise.all([
    db.gyms.toArray(), db.settings.toArray(), db.sessions.toArray(), db.sets.toArray(),
  ])
  return { app: 'gymbro', exportedAt: new Date().toISOString(), version: 1, gyms, settings, sessions, sets }
}

export async function resetAll() {
  await Promise.all([db.gyms.clear(), db.settings.clear(), db.sessions.clear(), db.sets.clear()])
}

export type { SetKind }
