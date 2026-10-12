// Plan report (Design.md "History: finished plan → goal reached or not", ADR-019). Pure: compares the start and end
// of a plan's time window using logged workouts, InBody results, posture scans and goals.
import type { BodyComp, Session, SetLog, StoredPlan } from '../../db/db'
import type { WhyCode } from '../coach/why'
import { bestE1rm } from '../stats'
import type { Goal as TrainingGoal } from '../targets'

export const DEFAULT_WEEKS = 8
export const PLAN_WEEK_CHOICES = [4, 6, 8, 12]
const DAY = 86_400_000
/** Body measurements this close to the plan's start or end still count as its "before" and "after". */
export const MEASURE_SLACK_DAYS = 14

export interface PlanWindow { start: number; end: number; weeks: number; finished: boolean; week: number }

export function planWindow(plan: StoredPlan, now: number): PlanWindow {
  const weeks = plan.schedule.weeks ?? DEFAULT_WEEKS
  const start = plan.createdAt
  const end = plan.finishedAt ?? start + weeks * 7 * DAY
  return { start, end, weeks, finished: !!plan.finishedAt || now >= end, week: Math.min(weeks, Math.floor((Math.min(now, end) - start) / (7 * DAY)) + 1) }
}

export type Verdict = 'reached' | 'partly' | 'not_reached' | 'no_data'

export const VERDICT_LABEL: Record<Verdict, string> = { reached: 'Goal reached', partly: 'Partly reached', not_reached: 'Not reached', no_data: 'Not enough data' }

export interface Change { label: string; before: number; after: number; unit: string; better: 'up' | 'down' }

export interface PlanReport {
  window: PlanWindow
  goal: TrainingGoal
  verdict: Verdict
  /** One sentence on what the verdict is based on. */
  basis: string
  why: WhyCode
  workouts: { done: number; planned: number; adherence: number }
  lifts: { exerciseId: string; before: number; after: number; pct: number }[]
  avgLiftPct?: number
  body: Change[]
  posture?: { before: number; after: number }
  goalsReached: string[]
}

/** Thresholds per training goal (GymBro conventions; explained in "Why?"). */
export const VERDICT = {
  muscleKg: 0.5, // skeletal muscle gain that counts as reached
  fatPoints: 1, // body-fat percentage points lost that counts as reached
  strengthPct: 5, // average main-lift e1RM gain that counts as reached
  adherence: 0.75, // share of planned workouts done that counts as reached
  partlyAdherence: 0.5,
  athleticPct: 3,
}

export interface ReportInput {
  plan: StoredPlan
  goal: TrainingGoal
  sessions: Session[]
  sets: SetLog[]
  comps: BodyComp[]
  /** Posture scans in time order, reduced to how many confident findings each had. */
  scans: { takenAt: number; findings: number }[]
  goals: { title: string; achievedAt?: number }[]
  now: number
}

const r1 = (v: number) => Math.round(v * 10) / 10

export function planReport({ plan, goal, sessions, sets, comps, scans, goals, now }: ReportInput): PlanReport {
  const window = planWindow(plan, now)
  const inWindow = (t: number) => t >= window.start && t <= window.end
  const done = sessions.filter((s) => s.endedAt && s.planId === plan.id && inWindow(s.startedAt)).sort((a, b) => a.startedAt - b.startedAt)
  const weeksElapsed = Math.max(1, Math.min(window.weeks, (Math.min(now, window.end) - window.start) / (7 * DAY)))
  const planned = Math.max(1, Math.round(plan.days.length * weeksElapsed))
  const adherence = Math.min(1, done.length / planned)

  // Main lifts: first vs last session in the window that trained each one.
  const mainIds = [...new Set(plan.days.flatMap((d) => d.items.filter((i) => i.role === 'main').map((i) => i.exerciseId)))]
  const setsBySession = new Map<string, SetLog[]>()
  for (const s of sets) (setsBySession.get(s.sessionId) ?? setsBySession.set(s.sessionId, []).get(s.sessionId)!).push(s)
  const windowSessions = sessions.filter((s) => s.endedAt && inWindow(s.startedAt)).sort((a, b) => a.startedAt - b.startedAt)
  const lifts: PlanReport['lifts'] = []
  for (const id of mainIds) {
    const series = windowSessions.map((s) => bestE1rm((setsBySession.get(s.id) ?? []).filter((x) => x.exerciseId === id && x.weightKg > 0))).filter((v) => v > 0)
    if (series.length >= 2) lifts.push({ exerciseId: id, before: r1(series[0]), after: r1(series.at(-1)!), pct: r1(((series.at(-1)! - series[0]) / series[0]) * 100) })
  }
  const avgLiftPct = lifts.length ? r1(lifts.reduce((s, l) => s + l.pct, 0) / lifts.length) : undefined

  // Body: the InBody result nearest the start (up to 14 days before or after) and the last one by the end.
  const slack = MEASURE_SLACK_DAYS * DAY
  const sortedComps = [...comps].sort((a, b) => a.measuredAt - b.measuredAt)
  const before = sortedComps.filter((c) => c.measuredAt >= window.start - slack && c.measuredAt <= window.start + slack)[0]
  const after = sortedComps.filter((c) => c.measuredAt <= window.end + slack && before && c.measuredAt > before.measuredAt + 7 * DAY).at(-1)
  const body: Change[] = []
  const metric = (key: 'weightKg' | 'smmKg' | 'pbf' | 'bodyFatKg', label: string, unit: string, better: 'up' | 'down') => {
    const b = before?.values[key], a = after?.values[key]
    if (b !== undefined && a !== undefined) body.push({ label, before: b, after: a, unit, better })
  }
  metric('smmKg', 'Skeletal muscle', 'kg', 'up')
  metric('pbf', 'Body fat', '%', 'down')
  metric('bodyFatKg', 'Fat mass', 'kg', 'down')
  metric('weightKg', 'Body weight', 'kg', goal === 'fat_loss' ? 'down' : 'up')
  const delta = (label: string) => { const c = body.find((x) => x.label === label); return c ? c.after - c.before : undefined }

  // Posture: first vs last scan in the window (with slack).
  const sc = scans.filter((s) => s.takenAt >= window.start - slack && s.takenAt <= window.end + slack)
  const posture = sc.length >= 2 ? { before: sc[0].findings, after: sc.at(-1)!.findings } : undefined

  // Verdict by training goal.
  let verdict: Verdict = 'no_data', basis = 'Not enough logged data in this plan to judge it.', why: WhyCode = 'verdict_general'
  const byStrength = (threshold: number, label: string) => {
    if (avgLiftPct === undefined) return
    verdict = avgLiftPct >= threshold ? 'reached' : avgLiftPct > 0 ? 'partly' : 'not_reached'
    basis = `${label}: main lifts ${avgLiftPct >= 0 ? '+' : ''}${avgLiftPct}% on average (target +${threshold}%).`
  }
  if (goal === 'hypertrophy') {
    why = 'verdict_muscle'
    const d = delta('Skeletal muscle')
    if (d !== undefined) {
      verdict = d >= VERDICT.muscleKg ? 'reached' : d > 0 ? 'partly' : 'not_reached'
      basis = `Skeletal muscle ${d >= 0 ? '+' : ''}${r1(d)} kg on InBody (target +${VERDICT.muscleKg} kg).`
    } else byStrength(VERDICT.strengthPct, 'No InBody before and after, so judged by strength')
  } else if (goal === 'fat_loss') {
    why = 'verdict_fat'
    const d = delta('Body fat')
    if (d !== undefined) {
      verdict = d <= -VERDICT.fatPoints ? 'reached' : d < 0 ? 'partly' : 'not_reached'
      basis = `Body fat ${d >= 0 ? '+' : ''}${r1(d)} percentage points on InBody (target −${VERDICT.fatPoints}).`
    } else {
      basis = 'Fat loss is judged by InBody: log a result near the start and the end of a plan.'
    }
  } else if (goal === 'strength') {
    why = 'verdict_strength'
    byStrength(VERDICT.strengthPct, 'Strength')
  } else if (goal === 'athletic') {
    why = 'verdict_athletic'
    if (avgLiftPct !== undefined) {
      const ok = avgLiftPct >= VERDICT.athleticPct && adherence >= 0.7
      verdict = ok ? 'reached' : avgLiftPct > 0 || adherence >= VERDICT.partlyAdherence ? 'partly' : 'not_reached'
      basis = `Main lifts ${avgLiftPct >= 0 ? '+' : ''}${avgLiftPct}% with ${Math.round(adherence * 100)}% of planned sessions done (targets +${VERDICT.athleticPct}% and 70%).`
    }
  } else {
    why = 'verdict_general'
    if (done.length) {
      verdict = adherence >= VERDICT.adherence ? 'reached' : adherence >= VERDICT.partlyAdherence ? 'partly' : 'not_reached'
      basis = `${done.length} of ${planned} planned workouts done (${Math.round(adherence * 100)}%, target ${Math.round(VERDICT.adherence * 100)}%).`
    }
  }

  return {
    window, goal, verdict, basis, why,
    workouts: { done: done.length, planned, adherence },
    lifts, avgLiftPct, body, posture,
    goalsReached: goals.filter((g) => g.achievedAt && inWindow(g.achievedAt)).map((g) => g.title),
  }
}
