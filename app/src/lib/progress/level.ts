// Level, stats, weekly activity and badges (Design.md "Today", ADR-017). Pure and derived: nothing is stored, so the
// numbers always match the logged history. All formulas are GymBro conventions, explained in the "Why?" registry.
import { EXERCISE_BY_ID } from '../../data/exercises'
import type { Session, SetLog } from '../../db/db'
import { weekStart } from '../coach/signals'
import type { WhyCode } from '../coach/why'
import { bestE1rm, findPRs, volumeKg } from '../stats'

// ---------------- XP and level ----------------
export const XP_PER_WORKOUT = 100
export const XP_PER_SET = 2
export const XP_SET_CAP = 30
export const XP_PER_RECORD = 50
export const XP_PER_GOAL_WEEK = 150

/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, 4 = 600, 5 = 1000 …). */
export const xpForLevel = (level: number) => 50 * level * (level - 1)
export function levelFor(xp: number) {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return { level, floor: xpForLevel(level), next: xpForLevel(level + 1) }
}

// ---------------- Inputs ----------------
export interface ProgressInput {
  sessions: Session[]
  sets: SetLog[]
  /** Workouts per week the active plan asks for (default 3). */
  planDays?: number
  /** Minutes per session the plan asks for (default 60). */
  sessionMinutes?: number
  /** Latest InBody weight; strength is judged relative to it (75 kg assumed without it). */
  bodyweightKg?: number
  /** Balance inputs; undefined when there is no body data at all. */
  balance?: { findings: { severity: 'mild' | 'moderate' | 'marked' }[]; trunk?: 'normal' | 'borderline' | 'refer'; weakSides: number }
  hasPostureScan?: boolean
  hasInBody?: boolean
  /** Session ids that were sport or focus days. */
  focusSessionIds?: Set<string>
  now: number
}

export type StatKey = 'strength' | 'endurance' | 'power' | 'consistency' | 'balance'
export interface Stat { key: StatKey; label: string; value: number | null; hint: string; why: WhyCode }

export interface Badge { id: string; title: string; detail: string; icon: string; unlocked: boolean; at?: number; progress?: string }

export interface Progress {
  xp: number
  level: number
  levelFloor: number
  nextLevel: number
  week: { workouts: number; targetWorkouts: number; minutes: number; targetMinutes: number }
  streakWeeks: number
  stats: Stat[]
  badges: Badge[]
  totals: { workouts: number; records: number; volumeKg: number }
}

const WEEK = 7 * 86_400_000
const clamp99 = (v: number) => Math.max(0, Math.min(99, Math.round(v)))

/** A workout counts once it's finished and has at least one working set. */
function workouts(sessions: Session[], setsBy: Map<string, SetLog[]>) {
  return sessions.filter((s) => s.endedAt && (setsBy.get(s.id) ?? []).some((x) => x.kind === 'working'))
    .sort((a, b) => a.startedAt - b.startedAt)
}

export function computeProgress(input: ProgressInput): Progress {
  const { now } = input
  const planDays = input.planDays ?? 3
  const sessionMinutes = input.sessionMinutes ?? 60
  const setsBy = new Map<string, SetLog[]>()
  for (const s of input.sets) (setsBy.get(s.sessionId) ?? setsBy.set(s.sessionId, []).get(s.sessionId)!).push(s)
  const done = workouts(input.sessions, setsBy)

  // XP, records and running totals, in order, so badge unlock dates are known.
  let xp = 0, records = 0, volume = 0
  const earlier: SetLog[] = []
  const at: Record<string, number> = {}
  const unlockAt = (id: string, t: number) => { at[id] ??= t }
  done.forEach((s, i) => {
    const ss = setsBy.get(s.id) ?? []
    const working = ss.filter((x) => x.kind === 'working').length
    // One record per exercise per workout: a heavier weight usually also raises the estimated 1RM.
    const prs = new Set(findPRs(ss, earlier).map((p) => p.exerciseId)).size
    xp += XP_PER_WORKOUT + XP_PER_SET * Math.min(XP_SET_CAP, working) + XP_PER_RECORD * prs
    records += prs
    volume += volumeKg(ss)
    earlier.push(...ss)
    const n = i + 1
    if (n >= 1) unlockAt('first_workout', s.startedAt)
    if (n >= 10) unlockAt('workouts_10', s.startedAt)
    if (n >= 50) unlockAt('workouts_50', s.startedAt)
    if (n >= 100) unlockAt('workouts_100', s.startedAt)
    if (records >= 1) unlockAt('first_record', s.startedAt)
    if (records >= 10) unlockAt('records_10', s.startedAt)
    if (volume >= 10_000) unlockAt('tonnes_10', s.startedAt)
    if (volume >= 100_000) unlockAt('tonnes_100', s.startedAt)
    if (input.focusSessionIds?.has(s.id)) unlockAt('athlete', s.startedAt)
  })

  // Weeks that met the plan: XP bonus and streak (current week counts once it's met).
  const perWeek = new Map<number, number>()
  for (const s of done) perWeek.set(weekStart(s.startedAt), (perWeek.get(weekStart(s.startedAt)) ?? 0) + 1)
  const thisWeek = weekStart(now)
  const goalWeeks = [...perWeek].filter(([, n]) => n >= planDays).map(([w]) => w).sort((a, b) => a - b)
  xp += XP_PER_GOAL_WEEK * goalWeeks.length
  let streak = 0
  for (let w = (perWeek.get(thisWeek) ?? 0) >= planDays ? thisWeek : thisWeek - WEEK; (perWeek.get(w) ?? 0) >= planDays; w -= WEEK) streak++
  // Streak badges: first time a run of 4 / 12 goal weeks completed.
  let run = 0
  goalWeeks.forEach((w, i) => {
    run = i > 0 && goalWeeks[i - 1] === w - WEEK ? run + 1 : 1
    if (run >= 4) unlockAt('streak_4', w + WEEK - 1)
    if (run >= 12) unlockAt('streak_12', w + WEEK - 1)
  })

  const { level, floor, next } = levelFor(xp)
  if (level >= 10) unlockAt('level_10', now)

  // This week's activity.
  const weekDone = done.filter((s) => s.startedAt >= thisWeek)
  const minutes = Math.round(weekDone.reduce((m, s) => m + (s.endedAt! - s.startedAt) / 60_000, 0))

  // ---------------- Stats (0–99) ----------------
  const fourWeeks = now - 4 * WEEK
  const recent = done.filter((s) => s.startedAt >= fourWeeks)
  const bw = input.bodyweightKg ?? 75
  const bestOf = (pred: (id: string) => boolean) => {
    let best = 0
    for (const s of done) {
      const ss = (setsBy.get(s.id) ?? []).filter((x) => pred(x.exerciseId))
      if (ss.length) best = Math.max(best, bestE1rm(ss))
    }
    return best
  }
  const isCompound = (pattern: string) => (id: string) => {
    const ex = EXERCISE_BY_ID.get(id)
    return !!ex && ex.pattern === pattern && ex.mechanics === 'compound' && ex.load !== 'bodyweight'
  }
  const strengthRatio = (bestOf(isCompound('squat')) + bestOf(isCompound('hinge')) + bestOf(isCompound('h_push'))) / bw
  const weeklySets = recent.reduce((n, s) => n + (setsBy.get(s.id) ?? []).filter((x) => x.kind === 'working').length, 0) / 4
  const powerSessions = recent.filter((s) => (setsBy.get(s.id) ?? []).some((x) => {
    const p = EXERCISE_BY_ID.get(x.exerciseId)?.pattern
    return p === 'power' || p === 'agility'
  })).length
  let balance: number | null = null
  if (input.balance) {
    const penalty = { mild: 12, moderate: 20, marked: 30 } as const
    balance = clamp99(99 - input.balance.findings.reduce((p, f) => p + penalty[f.severity], 0)
      - (input.balance.trunk === 'refer' ? 30 : input.balance.trunk === 'borderline' ? 15 : 0) - 10 * input.balance.weakSides)
    if (balance >= 85) unlockAt('balanced', now)
  }
  if (input.hasPostureScan) unlockAt('body_scan', now)
  if (input.hasInBody) unlockAt('measured', now)

  const stats: Stat[] = [
    { key: 'strength', label: 'Strength', value: done.length ? clamp99((strengthRatio / 5) * 99) : null, hint: `Best squat + hinge + press = ${strengthRatio.toFixed(1)}× bodyweight${input.bodyweightKg ? '' : ' (75 kg assumed)'}`, why: 'stat_strength' },
    { key: 'endurance', label: 'Endurance', value: done.length ? clamp99(weeklySets * 2) : null, hint: `${Math.round(weeklySets)} working sets per week (last 4 weeks)`, why: 'stat_endurance' },
    { key: 'power', label: 'Power', value: done.length ? clamp99(powerSessions * 12) : null, hint: `${powerSessions} session${powerSessions === 1 ? '' : 's'} with jumps or throws (last 4 weeks)`, why: 'stat_power' },
    { key: 'consistency', label: 'Consistency', value: done.length ? clamp99((recent.length / (planDays * 4)) * 99) : null, hint: `${recent.length} of ${planDays * 4} planned workouts (last 4 weeks)`, why: 'stat_consistency' },
    { key: 'balance', label: 'Balance', value: balance, hint: balance === null ? 'Do a posture scan or trunk test to measure it' : 'From your posture scan, trunk test and InBody left/right', why: 'stat_balance' },
  ]

  const count = (n: number, of: number) => `${Math.min(n, of)} / ${of}`
  const defs: Omit<Badge, 'unlocked' | 'at'>[] = [
    { id: 'first_workout', title: 'First step', detail: 'Finish your first workout', icon: '◆', progress: count(done.length, 1) },
    { id: 'workouts_10', title: 'Regular', detail: 'Finish 10 workouts', icon: '◈', progress: count(done.length, 10) },
    { id: 'workouts_50', title: 'Dedicated', detail: 'Finish 50 workouts', icon: '⬢', progress: count(done.length, 50) },
    { id: 'workouts_100', title: 'Centurion', detail: 'Finish 100 workouts', icon: '✪', progress: count(done.length, 100) },
    { id: 'first_record', title: 'Record breaker', detail: 'Set a personal record', icon: '▲', progress: count(records, 1) },
    { id: 'records_10', title: 'Unstoppable', detail: 'Set 10 personal records', icon: '⏶', progress: count(records, 10) },
    { id: 'streak_4', title: 'Locked in', detail: 'Hit your weekly plan 4 weeks in a row', icon: '⚡', progress: count(streak, 4) },
    { id: 'streak_12', title: 'Iron will', detail: 'Hit your weekly plan 12 weeks in a row', icon: '✦', progress: count(streak, 12) },
    { id: 'tonnes_10', title: '10 tonnes', detail: 'Lift 10,000 kg in total', icon: '■', progress: `${Math.round(Math.min(volume, 10_000) / 100) / 10} / 10 t` },
    { id: 'tonnes_100', title: '100 tonnes', detail: 'Lift 100,000 kg in total', icon: '▣', progress: `${Math.round(Math.min(volume, 100_000) / 1000)} / 100 t` },
    { id: 'athlete', title: 'Athlete', detail: 'Finish a sport or focus day', icon: '➶' },
    { id: 'body_scan', title: 'Self-aware', detail: 'Do a posture scan', icon: '◎' },
    { id: 'measured', title: 'Measured', detail: 'Log an InBody result', icon: '≋' },
    { id: 'balanced', title: 'Balanced', detail: 'Reach a Balance score of 85 or more', icon: '⚖', progress: balance === null ? 'needs body data' : `${balance} / 85` },
    { id: 'level_10', title: 'Level 10', detail: 'Reach level 10', icon: '✹', progress: count(level, 10) },
  ]
  const badges = defs.map((d) => ({ ...d, unlocked: d.id in at, at: at[d.id] }))

  return {
    xp, level, levelFloor: floor, nextLevel: next,
    week: { workouts: weekDone.length, targetWorkouts: planDays, minutes, targetMinutes: planDays * sessionMinutes },
    streakWeeks: streak,
    stats, badges,
    totals: { workouts: done.length, records, volumeKg: Math.round(volume) },
  }
}
