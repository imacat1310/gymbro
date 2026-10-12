// Data access helpers. Components read through useLiveQuery and write through these functions.
import { EXERCISE_BY_ID, type Muscle } from '../data/exercises'
import type { Area } from '../data/stress'
import type { BodyData } from '../lib/bodyInput'
import type { FocusId } from '../lib/focus'
import { addDay } from '../lib/planEdit'
import { buildPlan, substituteForGym, weeklySets, type Plan, type PlanDay } from '../lib/planner'
import type { LoggedSet } from '../lib/progression'
import { defaultTarget, type Profile } from '../lib/targets'
import { db, uid, type Assessment, type BodyComp, type Goal, type Gym, type Schedule, type SessionEntry, type SetKind, type SetLog, type PostureScan, type Settings, type StoredPlan } from './db'

export const DEFAULT_PROFILE: Profile = { goal: 'hypertrophy', experience: 'beginner', intensity: 'moderate' }

export const DEFAULT_SCHEDULE: Schedule = { daysPerWeek: 3, sessionMinutes: 60 }

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

/** Start a workout: empty, or from a plan day (exercises swapped for what the current gym allows). */
export async function startSession(fromPlan?: { plan: StoredPlan; dayIndex: number }): Promise<string> {
  const active = await getActiveSession()
  if (active) return active.id
  const s = await getSettings()
  const id = uid()
  let entries: SessionEntry[] = []
  if (fromPlan) {
    const gym = s.activeGymId ? await db.gyms.get(s.activeGymId) : undefined
    const day = fromPlan.plan.days[fromPlan.dayIndex]
    // Safety net: a referral after the plan was built still pauses heavy spinal loading in today's workout.
    const pause = (await getBodyPlanInput())?.pause
    const limitations: Area[] = [...(s.limitations ?? []), ...(pause ? ['lower_back' as const] : [])]
    entries = day.items.flatMap((item) => {
      const exerciseId = gym ? substituteForGym(item, gym.equipment, limitations) : item.exerciseId
      return exerciseId ? [{ key: uid(), exerciseId, target: item.target }] : []
    })
  }
  await db.sessions.add({
    id, gymId: s.activeGymId, startedAt: Date.now(), entries,
    planId: fromPlan?.plan.id, dayIndex: fromPlan?.dayIndex,
  })
  return id
}

export async function getActivePlan(): Promise<StoredPlan | undefined> {
  const s = await getSettings()
  return s.activePlanId ? db.plans.get(s.activePlanId) : undefined
}

/** Plan days rotate in order: the day after the last finished plan workout. */
export async function nextPlanDayIndex(plan: StoredPlan): Promise<number> {
  const last = await db.sessions.orderBy('startedAt').reverse()
    .filter((x) => x.planId === plan.id && !!x.endedAt && x.dayIndex !== undefined).first()
  return last ? (last.dayIndex! + 1) % plan.days.length : 0
}

/** Latest posture scan, trunk test and InBody result, plus referral acknowledgements. */
export async function getBodyData(): Promise<BodyData> {
  const [scan, trunk, comp, s] = await Promise.all([
    db.postureScans.orderBy('takenAt').last(),
    db.assessments.where('type').equals('trunk_rotation').sortBy('takenAt').then((a) => a.at(-1)),
    db.bodyComps.orderBy('measuredAt').last(),
    getSettings(),
  ])
  return { scan, trunk, comp, acks: s.referralAck }
}

/** Loaded on demand: posture analysis is only needed when a plan is built or the Plan tab checks for new data. */
export async function getBodyPlanInput() {
  const [{ bodyPlanInput }, data] = await Promise.all([import('../lib/bodyInput'), getBodyData()])
  return bodyPlanInput(data)
}

/** The user read the referral card and chose to include the paused exercises again. */
export async function acknowledgeReferrals(ids: string[]) {
  const s = await getSettings()
  const now = Date.now()
  await saveSettings({ referralAck: { ...s.referralAck, ...Object.fromEntries(ids.map((id) => [id, now])) } })
}

export interface PlanPrefs {
  name: string
  schedule: Schedule
  priorities: Muscle[]
  /** Session focus per day; when rebuilding and not given, the plan's current focuses are kept. */
  dayFocus?: (FocusId | null)[]
}

/**
 * Build a plan from preferences, the profile, injuries and the active gym, and make it active.
 * With `replaceId` the plan is rebuilt in place (same id and name), so its day rotation and history carry on.
 */
export async function buildAndSavePlan(prefs: PlanPrefs, replaceId?: string): Promise<StoredPlan> {
  const s = await getSettings()
  const gym = s.activeGymId ? await db.gyms.get(s.activeGymId) : undefined
  const body = await getBodyPlanInput()
  const previous = replaceId ? await db.plans.get(replaceId) : undefined
  const dayFocus = (prefs.dayFocus ?? previous?.dayFocus ?? []).slice(0, prefs.schedule.daysPerWeek)
  const plan: Plan = buildPlan({
    profile: s.profile,
    daysPerWeek: prefs.schedule.daysPerWeek,
    sessionMinutes: prefs.schedule.sessionMinutes,
    equipment: gym?.equipment ?? [],
    limitations: s.limitations ?? [],
    priorities: prefs.priorities,
    body,
    dayFocus,
  })
  const old = previous
  const now = Date.now()
  const stored: StoredPlan = {
    ...plan,
    id: old?.id ?? uid(),
    name: prefs.name.trim() || plan.splitName,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
    gymId: gym?.id,
    schedule: prefs.schedule,
    priorities: prefs.priorities,
    bodyDataAt: body?.latestAt,
    pausedSpinal: !!body?.pause,
    dayFocus: dayFocus.some(Boolean) ? dayFocus : undefined,
    goal: s.profile.goal,
  }
  await db.transaction('rw', db.plans, db.settings, async () => {
    await db.plans.put(stored)
    // The last preferences used become the defaults for the next new plan.
    await db.settings.put({ ...s, activePlanId: stored.id, schedule: prefs.schedule, priorities: prefs.priorities })
  })
  return stored
}

/** A blank plan with one empty day, to fill in by hand. */
export async function createEmptyPlan(name: string): Promise<StoredPlan> {
  const s = await getSettings()
  const now = Date.now()
  const stored: StoredPlan = {
    id: uid(), name: name.trim() || 'My plan', splitName: 'Custom', createdAt: now, updatedAt: now,
    gymId: s.activeGymId, schedule: s.schedule ?? DEFAULT_SCHEDULE, priorities: [],
    days: addDay([]), weeklySets: {}, notes: [], edited: true,
  }
  await db.transaction('rw', db.plans, db.settings, async () => {
    await db.plans.add(stored)
    await db.settings.put({ ...s, activePlanId: stored.id })
  })
  return stored
}

export async function duplicatePlan(id: string): Promise<StoredPlan | undefined> {
  const plan = await db.plans.get(id)
  if (!plan) return
  const now = Date.now()
  const copy: StoredPlan = { ...structuredClone(plan), id: uid(), name: `${plan.name} (copy)`, createdAt: now, updatedAt: now }
  await db.plans.add(copy)
  await saveSettings({ activePlanId: copy.id })
  return copy
}

/** Give one day of a plan a session focus (or null for the standard day) and rebuild the plan. */
export async function setDayFocus(planId: string, dayIndex: number, focus: FocusId | null) {
  const plan = await db.plans.get(planId)
  if (!plan) return
  const dayFocus = [...(plan.dayFocus ?? [])]
  while (dayFocus.length < plan.days.length) dayFocus.push(null)
  dayFocus[dayIndex] = focus
  await buildAndSavePlan({ name: plan.name, schedule: plan.schedule, priorities: plan.priorities, dayFocus }, plan.id)
}

/** End a plan early; its report then compares its start with today. */
export const finishPlan = (id: string) => db.plans.update(id, { finishedAt: Date.now() })

export const renamePlan = (id: string, name: string) =>
  db.plans.update(id, { name: name.trim() || 'My plan', updatedAt: Date.now() })

export const setActivePlan = (id: string) => saveSettings({ activePlanId: id })

/** Delete a plan. Past workouts keep their sets; if it was active, the most recently changed plan takes over. */
export async function deletePlan(id: string) {
  await db.transaction('rw', db.plans, db.settings, async () => {
    await db.plans.delete(id)
    const s = await getSettings()
    if (s.activePlanId === id) {
      const next = (await db.plans.toArray()).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))[0]
      await db.settings.put({ ...s, activePlanId: next?.id })
    }
  })
}

/** Apply a hand edit (lib/planEdit.ts) to a plan's days. */
export async function editPlanDays(id: string, edit: (days: PlanDay[]) => PlanDay[]) {
  const plan = await db.plans.get(id)
  if (!plan) return
  const days = edit(plan.days)
  if (days === plan.days) return
  await db.plans.update(id, { days, weeklySets: weeklySets(days), edited: true, updatedAt: Date.now() })
}

export const listPlans = () => db.plans.toArray().then((ps) => ps.sort((a, b) => a.createdAt - b.createdAt))

/** Replace one exercise in a plan; the old one becomes an alternative. */
export async function swapPlanExercise(planId: string, dayIndex: number, itemIndex: number, exerciseId: string) {
  const plan = await db.plans.get(planId)
  const ex = EXERCISE_BY_ID.get(exerciseId)
  if (!plan || !ex) return
  const { profile } = await getSettings()
  const days = structuredClone(plan.days)
  const item = days[dayIndex].items[itemIndex]
  const target = defaultTarget(ex, profile)
  days[dayIndex].items[itemIndex] = {
    ...item,
    exerciseId,
    target: { ...target, sets: item.target.sets },
    reason: `${item.reason} (your pick)`,
    alternatives: [item.exerciseId, ...item.alternatives.filter((a) => a !== exerciseId)].slice(0, 4),
  }
  await db.plans.update(planId, { days })
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
  const [gyms, settings, sessions, sets, plans, postureScans, bodyComps, assessments, goals] = await Promise.all([
    db.gyms.toArray(), db.settings.toArray(), db.sessions.toArray(), db.sets.toArray(), db.plans.toArray(), db.postureScans.toArray(), db.bodyComps.toArray(), db.assessments.toArray(), db.goals.toArray(),
  ])
  return { app: 'gymbro', exportedAt: new Date().toISOString(), version: 7, gyms, settings, sessions, sets, plans, postureScans, bodyComps, assessments, goals }
}

export async function resetAll() {
  await Promise.all([db.gyms.clear(), db.settings.clear(), db.sessions.clear(), db.sets.clear(), db.plans.clear(), db.postureScans.clear(), db.bodyComps.clear(), db.assessments.clear(), db.goals.clear()])
}

export async function savePostureScan(scan: Omit<PostureScan, 'id' | 'appVersion'>) {
  const id = uid()
  await db.postureScans.add({ ...scan, id, appVersion: __APP_VERSION__ })
  return id
}

export const deletePostureScan = (id: string) => db.postureScans.delete(id)

export async function saveBodyComp(entry: Omit<BodyComp, 'id' | 'createdAt'>) {
  const id = uid()
  await db.bodyComps.add({ ...entry, id, createdAt: Date.now() })
  return id
}

export const deleteBodyComp = (id: string) => db.bodyComps.delete(id)

export async function saveAssessment(a: Omit<Assessment, 'id'>) {
  const id = uid()
  await db.assessments.add({ ...a, id })
  return id
}

export const deleteAssessment = (id: string) => db.assessments.delete(id)

/** Create a goal, recording today's starting value so progress and pace can be shown. */
export async function addGoal(g: Omit<Goal, 'id' | 'createdAt' | 'start'>) {
  const { startingValue } = await import('../lib/progress/goals')
  const [sets, comps] = await Promise.all([g.kind === 'lift' ? db.sets.where('exerciseId').equals(g.exerciseId!).toArray() : [], db.bodyComps.toArray()])
  const id = uid()
  await db.goals.add({ ...g, id, createdAt: Date.now(), start: startingValue(g, sets, comps) })
  return id
}

export const deleteGoal = (id: string) => db.goals.delete(id)

export type { SetKind }
