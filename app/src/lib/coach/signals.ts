// Coach signals and the single insight shown on Today (ADR-016). Pure: derived from logged sessions, the active plan
// and body data. The design (stall test, deload from several stalled lifts, a priority selector over deterministic
// signals, a "what your coach sees" summary) is adapted from gymcoach, MIT licence, © 2026 GymCoach contributors
// (github.com/gymcoach-app/gymcoach: lib/stats.ts, lib/deload.ts, lib/home-insight.ts, lib/coach-context.ts).
import { EXERCISE_BY_ID } from '../../data/exercises'
import type { Session, SetLog, StoredPlan } from '../../db/db'
import type { BodyPlanInput } from '../bodyInput'
import { bestE1rm, findPRs } from '../stats'
import type { WhyCode } from './why'

/** Sessions a lift must go without beating its earlier best before it counts as stalled. */
export const STALL_LOOKBACK_SESSIONS = 3
/** An estimated 1RM must beat the earlier best by more than this (0.5%) to count: rounding isn't progress. */
export const STALL_TOLERANCE = 0.005
/** This many stalled lifts at once reads as general fatigue rather than one exercise needing a tweak. */
export const DELOAD_STALLED_LIFTS_MIN = 2
/** Only lifts trained in this window are judged; an old exercise you dropped isn't "stalled". */
export const RECENT_DAYS = 42

/**
 * Stall test over a lift's per-session best estimated 1RM (oldest → newest): true when none of the last `lookback`
 * sessions beat the best before them by more than the tolerance. Never flags with fewer than `lookback` sessions.
 */
export function isStalled(series: number[], lookback = STALL_LOOKBACK_SESSIONS): boolean {
  if (lookback < 2 || series.length < lookback) return false
  const start = series.length - lookback
  let best = start === 0 ? series[0] : Math.max(...series.slice(0, start))
  for (let i = start === 0 ? 1 : start; i < series.length; i++) {
    if (series[i] > best * (1 + STALL_TOLERANCE)) return false
    best = Math.max(best, series[i])
  }
  return true
}

/** Monday 00:00 of the week containing `t`, local time. */
export function weekStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export interface Signals {
  stalled: string[]
  deloadRecommended: boolean
  sessionsThisWeek: number
  planDays: number | null
  lastRecords: { exerciseId: string; kind: 'e1rm' | 'weight' }[]
  pause?: string
  newBodyData: boolean
  bodySources: string[]
  weeksOfHistory: number
  exercisesTracked: number
  /** Goals reached in the last 3 days, and counts for the coach view. */
  goalsReached: { title: string; kind: 'lift' | 'body' }[]
  goalsActive: number
  goalsDone: number
}

export interface SignalInput {
  sessions: Session[]
  sets: SetLog[]
  plan?: StoredPlan | null
  body?: BodyPlanInput
  goals?: { title: string; kind: 'lift' | 'body'; achieved: boolean; achievedAt?: number }[]
  now: number
}

export function deriveSignals({ sessions, sets, plan, body, goals = [], now }: SignalInput): Signals {
  const finished = sessions.filter((s) => s.endedAt).sort((a, b) => a.startedAt - b.startedAt)
  const setsBySession = new Map<string, SetLog[]>()
  for (const s of sets) (setsBySession.get(s.sessionId) ?? setsBySession.set(s.sessionId, []).get(s.sessionId)!).push(s)

  // Per-lift series of per-session best estimated 1RM, for weighted rep-based lifts trained recently.
  const series = new Map<string, { values: number[]; last: number }>()
  for (const sess of finished) {
    const byEx = new Map<string, SetLog[]>()
    for (const s of setsBySession.get(sess.id) ?? []) if (s.kind === 'working' && s.weightKg > 0) (byEx.get(s.exerciseId) ?? byEx.set(s.exerciseId, []).get(s.exerciseId)!).push(s)
    for (const [id, exSets] of byEx) {
      if (EXERCISE_BY_ID.get(id)?.measure !== 'reps') continue
      const e = series.get(id) ?? { values: [], last: 0 }
      e.values.push(bestE1rm(exSets))
      e.last = sess.startedAt
      series.set(id, e)
    }
  }
  const recent = [...series].filter(([, e]) => now - e.last <= RECENT_DAYS * 86_400_000)
  const stalled = recent.filter(([, e]) => isStalled(e.values)).map(([id]) => id)

  const last = finished.at(-1)
  const lastRecords = last
    ? findPRs(setsBySession.get(last.id) ?? [], sets.filter((s) => s.completedAt < last.startedAt)).map((p) => ({ exerciseId: p.exerciseId, kind: p.kind }))
    : []

  const wk = weekStart(now)
  return {
    stalled,
    deloadRecommended: stalled.length >= DELOAD_STALLED_LIFTS_MIN,
    sessionsThisWeek: finished.filter((s) => s.startedAt >= wk).length,
    planDays: plan ? plan.days.length : null,
    lastRecords: last && now - (last.endedAt ?? last.startedAt) < 3 * 86_400_000 ? lastRecords : [],
    pause: body?.pause?.reason,
    newBodyData: !!(plan && body && (plan.bodyDataAt ?? 0) < body.latestAt),
    bodySources: body?.sources ?? [],
    weeksOfHistory: new Set(finished.map((s) => weekStart(s.startedAt))).size,
    exercisesTracked: series.size,
    goalsReached: goals.filter((g) => g.achievedAt && now - g.achievedAt < 3 * 86_400_000).map((g) => ({ title: g.title, kind: g.kind })),
    goalsActive: goals.filter((g) => !g.achieved).length,
    goalsDone: goals.filter((g) => g.achieved).length,
  }
}

export type InsightKind = 'pause' | 'deload' | 'goal' | 'stall' | 'record' | 'rebuild' | 'on_track' | 'behind'

export interface Insight {
  kind: InsightKind
  title: string
  detail: string
  href: string
  why: WhyCode
}

const name = (id: string) => EXERCISE_BY_ID.get(id)?.name ?? id
const list = (ids: string[]) => ids.map(name).join(', ')

/**
 * The single most important thing to tell the user today, or null with nothing to say (no history, no plan).
 * Priority: safety pause > deload > goal reached > stalled lift > fresh record > new body data > consistency.
 */
export function selectInsight(s: Signals): Insight | null {
  if (s.pause) {
    return { kind: 'pause', title: 'Heavy spinal loading is paused', detail: `Because ${s.pause}. Your plan swaps those exercises until you confirm it has been checked.`, href: '/plan', why: 'safety_pause' }
  }
  if (s.deloadRecommended) {
    return { kind: 'deload', title: 'Time for a lighter week', detail: `${s.stalled.length} lifts have stalled: ${list(s.stalled)}. A week at about 10% less load and fewer sets usually brings progress back.`, href: '/history', why: 'deload_week' }
  }
  if (s.goalsReached.length) {
    return { kind: 'goal', title: 'Goal reached', detail: `${s.goalsReached.map((g) => g.title).join('; ')}. Set the next one while you're on a roll.`, href: '/profile/goals', why: s.goalsReached[0].kind === 'lift' ? 'goal_lift' : 'goal_body' }
  }
  if (s.stalled.length) {
    return { kind: 'stall', title: `${name(s.stalled[0])} has stalled`, detail: `No progress in ${STALL_LOOKBACK_SESSIONS} sessions. Check your sleep and effort, or swap it for a variation for a few weeks.`, href: `/exercise/${s.stalled[0]}`, why: 'stalled' }
  }
  if (s.lastRecords.length) {
    const r = s.lastRecords[0]
    return { kind: 'record', title: 'New personal record', detail: `${name(r.exerciseId)}: ${r.kind === 'weight' ? 'heaviest weight yet' : 'best estimated one-rep max yet'}${s.lastRecords.length > 1 ? `, plus ${s.lastRecords.length - 1} more` : ''}.`, href: `/exercise/${r.exerciseId}`, why: 'record' }
  }
  if (s.newBodyData) {
    return { kind: 'rebuild', title: 'New body data', detail: `Your ${s.bodySources.join(', ')} can update your corrective work. Rebuild your plan to use it.`, href: '/plan', why: 'corrective' }
  }
  if (s.planDays) {
    return s.sessionsThisWeek >= s.planDays
      ? { kind: 'on_track', title: 'On track this week', detail: `${s.sessionsThisWeek} of ${s.planDays} planned workouts done. Recovery is part of the plan.`, href: '/history', why: 'consistency' }
      : { kind: 'behind', title: `${s.sessionsThisWeek} of ${s.planDays} workouts this week`, detail: s.sessionsThisWeek ? 'Keep the streak going: your next plan day is ready.' : 'Your first workout of the week is ready.', href: '/', why: 'consistency' }
  }
  return null
}

/** "What your coach sees": the signals in plain lines, shown to the user (and, later, an opt-in AI coach's input). */
export function coachView(s: Signals): string[] {
  return [
    `${s.weeksOfHistory} week${s.weeksOfHistory === 1 ? '' : 's'} of training history, ${s.exercisesTracked} weighted lift${s.exercisesTracked === 1 ? '' : 's'} tracked`,
    s.planDays ? `${s.sessionsThisWeek} of ${s.planDays} planned workouts this week` : 'No active plan',
    s.stalled.length ? `Stalled: ${list(s.stalled)}` : 'No stalled lifts',
    s.deloadRecommended ? 'Deload week recommended' : 'No deload needed',
    s.lastRecords.length ? `Recent records: ${list(s.lastRecords.map((r) => r.exerciseId))}` : 'No records in the last few days',
    s.bodySources.length ? `Body data: ${s.bodySources.join(', ')}` : 'No body data yet',
    s.goalsActive || s.goalsDone ? `Goals: ${s.goalsActive} active, ${s.goalsDone} reached` : 'No goals set',
    s.pause ? 'Safety pause active on lower-back loading' : 'No safety pause',
  ]
}
