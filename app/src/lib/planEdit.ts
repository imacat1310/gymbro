// Manual plan editing and rule checks (ADR-007). Edits are allowed even when they break the planner's rules;
// checkPlan() turns those into warnings instead. Pure functions: each edit returns new days.
import { EXERCISE_BY_ID, performableExercises, type Muscle } from '../data/exercises'
import { AREA_LABELS, stressedAreas, type Area } from '../data/stress'
import {
  estimateMinutes, GROUPS, groupSets, muscleLabel, PULL, PULL_BALANCERS, PUSH, VOLUME, weeklySets, type PlanDay, type PlanItem,
} from './planner'
import { defaultTarget, type Profile, type Target } from './targets'

const MAX_DAYS = 7

/** Recompute per-day minutes after an edit. */
const withMinutes = (days: PlanDay[]): PlanDay[] => days.map((d) => ({ ...d, estMinutes: estimateMinutes(d.items) }))

const mapDay = (days: PlanDay[], dayIndex: number, f: (d: PlanDay) => PlanDay) =>
  withMinutes(days.map((d, i) => (i === dayIndex ? f(d) : d)))

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list
  const out = [...list]
  const [x] = out.splice(from, 1)
  out.splice(to, 0, x)
  return out
}

export function addItem(days: PlanDay[], dayIndex: number, exerciseId: string, profile: Profile): PlanDay[] {
  const ex = EXERCISE_BY_ID.get(exerciseId)
  if (!ex) return days
  const item: PlanItem = { exerciseId, role: 'accessory', target: defaultTarget(ex, profile), reason: 'Added by you', alternatives: [] }
  return mapDay(days, dayIndex, (d) => ({ ...d, items: [...d.items, item] }))
}

export const removeItem = (days: PlanDay[], dayIndex: number, itemIndex: number) =>
  mapDay(days, dayIndex, (d) => ({ ...d, items: d.items.filter((_, i) => i !== itemIndex) }))

export const moveItem = (days: PlanDay[], dayIndex: number, itemIndex: number, by: -1 | 1) =>
  mapDay(days, dayIndex, (d) => ({ ...d, items: move(d.items, itemIndex, itemIndex + by) }))

/** Change sets / reps / RPE / rest. Keeps repMin ≤ repMax and everything in sane bounds. */
export function updateTarget(days: PlanDay[], dayIndex: number, itemIndex: number, patch: Partial<Target>): PlanDay[] {
  return mapDay(days, dayIndex, (d) => ({
    ...d,
    items: d.items.map((it, i) => {
      if (i !== itemIndex) return it
      const t = { ...it.target, ...patch }
      t.sets = Math.min(10, Math.max(1, Math.round(t.sets)))
      t.repMin = Math.max(1, Math.round(t.repMin))
      t.repMax = Math.max(1, Math.round(t.repMax))
      if (patch.repMin !== undefined && t.repMin > t.repMax) t.repMax = t.repMin
      if (patch.repMax !== undefined && t.repMax < t.repMin) t.repMin = t.repMax
      t.restSec = Math.min(600, Math.max(0, Math.round(t.restSec)))
      t.targetRpe = Math.min(10, Math.max(5, t.targetRpe))
      return { ...it, target: t }
    }),
  }))
}

export function addDay(days: PlanDay[]): PlanDay[] {
  if (days.length >= MAX_DAYS) return days
  return [...days, { name: `Day ${days.length + 1}`, items: [], estMinutes: estimateMinutes([]) }]
}

export const removeDay = (days: PlanDay[], dayIndex: number) => days.filter((_, i) => i !== dayIndex)
export const moveDay = (days: PlanDay[], dayIndex: number, by: -1 | 1) => move(days, dayIndex, dayIndex + by)
export const renameDay = (days: PlanDay[], dayIndex: number, name: string) =>
  days.map((d, i) => (i === dayIndex ? { ...d, name } : d))

export type WarningLevel = 'danger' | 'warn' | 'info'

export interface PlanWarning {
  level: WarningLevel
  text: string
  dayIndex?: number
  itemIndex?: number
}

export interface CheckContext {
  profile: Profile
  limitations: Area[]
  priorities: Muscle[]
  sessionMinutes: number
  /** Equipment at the plan's gym; omit to skip the equipment check. */
  equipment?: string[]
  gymName?: string
  /** Volume, balance and time checks only run on edited plans: generated plans explain these in their notes. */
  edited: boolean
}

/** Rule checks for a plan. Danger = conflicts with an injury the user entered. Never blocks anything. */
export function checkPlan(days: PlanDay[], ctx: CheckContext): PlanWarning[] {
  const out: PlanWarning[] = []

  days.forEach((d, dayIndex) => d.items.forEach((it, itemIndex) => {
    const hit = stressedAreas(it.exerciseId).filter((a) => ctx.limitations.includes(a))
    if (hit.length) {
      const name = EXERCISE_BY_ID.get(it.exerciseId)?.name ?? it.exerciseId
      out.push({
        level: 'danger', dayIndex, itemIndex,
        text: `${name} loads your ${hit.map((a) => AREA_LABELS[a].toLowerCase()).join(' and ')}, which you marked as injured or painful. Consider swapping it.`,
      })
    }
  }))

  if (ctx.equipment) {
    const can = new Set(performableExercises(ctx.equipment).map((e) => e.id))
    days.forEach((d, dayIndex) => d.items.forEach((it, itemIndex) => {
      if (!can.has(it.exerciseId)) {
        out.push({
          level: 'info', dayIndex, itemIndex,
          text: `${EXERCISE_BY_ID.get(it.exerciseId)?.name ?? it.exerciseId} isn't possible at ${ctx.gymName ?? 'this gym'}; it's swapped for a similar exercise when you start.`,
        })
      }
    }))
  }

  if (!ctx.edited) return out

  days.forEach((d, dayIndex) => {
    if (!d.items.length) out.push({ level: 'warn', dayIndex, text: `${d.name} has no exercises.` })
    else if (d.estMinutes > ctx.sessionMinutes + 10) {
      out.push({ level: 'warn', dayIndex, text: `${d.name} takes about ${d.estMinutes} min, more than your ${ctx.sessionMinutes} min sessions.` })
    }
  })

  const [floor, ceiling] = VOLUME[ctx.profile.experience][ctx.profile.intensity]
  const trained = (muscles: Muscle[]) => days.some((d) => d.items.some((i) => EXERCISE_BY_ID.get(i.exerciseId)?.primary.some((m) => muscles.includes(m))))
  for (const g of GROUPS) {
    const target = g.muscles.some((m) => ctx.priorities.includes(m)) ? Math.round(floor * 1.3) : floor
    const got = groupSets(days, g.muscles)
    if (got < target) {
      out.push({
        level: 'warn',
        text: trained(g.muscles)
          ? `${g.name}: ${got} sets/week, below the ${target}+ that builds muscle at your level.`
          : `${g.name}: no direct work in this plan.`,
      })
    }
  }
  for (const [m, sets] of Object.entries(weeklySets(days)) as [Muscle, number][]) {
    if (sets > ceiling + 2) {
      out.push({ level: 'warn', text: `${muscleLabel(m)[0].toUpperCase()}${muscleLabel(m).slice(1)}: ${+sets.toFixed(1)} sets/week, above the ~${ceiling} you can recover from at your level.` })
    }
  }

  let push = 0, pull = 0
  for (const d of days) for (const i of d.items) {
    const p = EXERCISE_BY_ID.get(i.exerciseId)?.pattern
    if (p && PUSH.includes(p)) push += i.target.sets
    if ((p && PULL.includes(p)) || PULL_BALANCERS.includes(i.exerciseId)) pull += i.target.sets
  }
  if (push > pull) {
    out.push({ level: 'warn', text: `More pushing (${push} sets) than pulling (${pull} sets) per week. For shoulder health, pull at least as much as you push.` })
  }

  return out
}
