// Plan builder v1 (features/03-training-plan.md). Deterministic rules engine: same input → same plan.
// Text rationale is template-based for now; an LLM explanation layer can replace `reason` later.
import { EXERCISE_BY_ID, EXERCISES, PATTERN_LABELS, performableExercises, type Exercise, type Muscle, type Pattern } from '../data/exercises'
import { isContraindicated, type Area } from '../data/stress'
import { defaultTarget, type Experience, type Intensity, type Profile, type Target } from './targets'

export type Role = 'main' | 'secondary' | 'accessory'

export interface PlanInput {
  profile: Profile
  daysPerWeek: number
  sessionMinutes: number
  equipment: string[]
  limitations: Area[]
  priorities: Muscle[]
  exclude?: string[]
}

export interface PlanItem {
  exerciseId: string
  role: Role
  target: Target
  reason: string
  alternatives: string[]
  /** Never dropped when trimming to fit the session length (pull work, push/pull balancer). */
  keep?: boolean
}

export interface PlanDay {
  name: string
  items: PlanItem[]
  estMinutes: number
}

export interface Plan {
  splitName: string
  days: PlanDay[]
  weeklySets: Partial<Record<Muscle, number>>
  notes: string[]
}

interface Slot {
  patterns: Pattern[]
  role: Role
  prefer?: Muscle[]
  reason?: string
}

const S = (patterns: Pattern | Pattern[], role: Role, prefer?: Muscle[]): Slot =>
  ({ patterns: Array.isArray(patterns) ? patterns : [patterns], role, prefer })

type Template = { name: string; region: 'upper' | 'lower' | 'full'; slots: Slot[] }

const T: Record<string, Template> = {
  fullA: { name: 'Full body A', region: 'full', slots: [
    S('squat', 'main'), S('h_push', 'main'), S('h_pull', 'secondary'), S('hinge', 'secondary'),
    S('shoulder_iso', 'accessory', ['side_delt']), S('core', 'accessory'),
  ] },
  fullB: { name: 'Full body B', region: 'full', slots: [
    S('hinge', 'main'), S('v_pull', 'main'), S('h_push', 'secondary'), S('lunge', 'secondary'),
    S('shoulder_iso', 'accessory', ['rear_delt']), S('core', 'accessory'),
  ] },
  fullC: { name: 'Full body C', region: 'full', slots: [
    S('squat', 'main'), S('v_push', 'main'), S('h_pull', 'secondary'), S('hip_iso', 'accessory', ['glutes']),
    S('arms', 'accessory', ['biceps']), S('arms', 'accessory', ['triceps']),
  ] },
  upperA: { name: 'Upper A', region: 'upper', slots: [
    S('h_push', 'main'), S('h_pull', 'main'), S('v_push', 'secondary'), S('v_pull', 'secondary'),
    S('shoulder_iso', 'accessory', ['side_delt']), S('arms', 'accessory', ['biceps']), S('arms', 'accessory', ['triceps']),
  ] },
  upperB: { name: 'Upper B', region: 'upper', slots: [
    S('v_pull', 'main'), S('v_push', 'main'), S('h_push', 'secondary'), S('h_pull', 'secondary'),
    S('shoulder_iso', 'accessory', ['rear_delt']), S('arms', 'accessory', ['biceps']), S('arms', 'accessory', ['triceps']),
  ] },
  lowerA: { name: 'Lower A', region: 'lower', slots: [
    S('squat', 'main'), S('hinge', 'secondary'), S('lunge', 'secondary'),
    S('knee_iso', 'accessory', ['hamstrings']), S('calves', 'accessory'), S('core', 'accessory'),
  ] },
  lowerB: { name: 'Lower B', region: 'lower', slots: [
    S('hinge', 'main'), S('squat', 'secondary'), S('hip_iso', 'accessory', ['glutes']),
    S('knee_iso', 'accessory', ['quads']), S('calves', 'accessory'), S('core', 'accessory'),
  ] },
  push: { name: 'Push', region: 'upper', slots: [
    S('h_push', 'main'), S('v_push', 'secondary'), S('h_push', 'accessory', ['chest']),
    S('shoulder_iso', 'accessory', ['side_delt']), S('arms', 'accessory', ['triceps']),
  ] },
  pull: { name: 'Pull', region: 'upper', slots: [
    S('v_pull', 'main'), S('h_pull', 'secondary'), S('h_pull', 'secondary'),
    S('shoulder_iso', 'accessory', ['rear_delt']), S('arms', 'accessory', ['biceps']), S('core', 'accessory'),
  ] },
  legs: { name: 'Legs', region: 'lower', slots: [
    S('squat', 'main'), S('hinge', 'secondary'), S('lunge', 'secondary'),
    S('knee_iso', 'accessory', ['hamstrings']), S('knee_iso', 'accessory', ['quads']), S('calves', 'accessory'),
  ] },
}

/** Split table (features/03-training-plan.md §1). */
export function chooseSplit(days: number, profile: Profile): { name: string; templates: Template[]; note?: string } {
  const beginner = profile.experience === 'beginner'
  if (days <= 2) return { name: 'Full body ×2', templates: [T.fullA, T.fullB] }
  if (days === 3) return { name: 'Full body ×3', templates: [T.fullA, T.fullB, T.fullC] }
  if (days === 4) return { name: 'Upper / Lower', templates: [T.upperA, T.lowerA, T.upperB, T.lowerB] }
  if (days === 5 || (beginner && profile.intensity !== 'hard' && profile.intensity !== 'max')) {
    const note = days >= 6 ? 'Capped at 5 days: as a beginner, 6 days only makes sense on Hard or Max intensity. Recovery is where you grow.' : undefined
    return beginner
      ? { name: 'Upper / Lower / Full', templates: [T.upperA, T.lowerA, T.fullC, T.upperB, T.lowerB], note }
      : { name: 'Push / Pull / Legs + Upper / Lower', templates: [T.push, T.pull, T.legs, T.upperA, T.lowerB], note }
  }
  return {
    name: 'Push / Pull / Legs ×2',
    templates: [T.push, T.pull, T.legs, { ...T.push, name: 'Push B' }, { ...T.pull, name: 'Pull B' }, { ...T.legs, name: 'Legs B' }],
  }
}

/** Technique-heavy lifts a beginner should earn first. */
const TECHNICAL = new Set(['barbell_front_squat', 'barbell_row', 'kb_swing', 'barbell_ohp'])

const UPPER_MUSCLES: Muscle[] = ['chest', 'front_delt', 'side_delt', 'rear_delt', 'triceps', 'biceps', 'forearms', 'lats', 'upper_back', 'lower_trap', 'traps', 'neck']
const LOWER_MUSCLES: Muscle[] = ['glutes', 'glute_med', 'quads', 'hamstrings', 'adductors', 'calves', 'hip_flexors']

export const PRIORITY_CHOICES: Muscle[] = [
  'chest', 'side_delt', 'rear_delt', 'upper_back', 'lats', 'biceps', 'triceps', 'abs', 'glutes', 'glute_med', 'quads', 'hamstrings', 'calves',
]

/** Bodyweight lifts that are easy to load (belt, vest) and make good main lifts. */
const WEIGHTABLE_BW = new Set(['pull_up', 'chin_up', 'dip'])
/** Easier versions to fall back on, not first choices for experienced lifters. */
const REGRESSIONS = new Set(['band_assisted_pull_up', 'bench_dip', 'bodyweight_squat', 'split_squat'])
const VARIETY_PENALTY: Record<Role, number> = { main: 1, secondary: 2, accessory: 4 }

function score(ex: Exercise, slot: Slot, input: PlanInput, used: Set<string>, bodyweightGym: boolean): number {
  const { profile, priorities } = input
  const beginner = profile.experience === 'beginner'
  let s = 0
  if (slot.role === 'main') {
    s += ex.mechanics === 'compound' ? 3 : -5
    if (ex.load === 'barbell') s += beginner && profile.goal !== 'strength' ? 1 : 2
    if (ex.load === 'machine' || ex.load === 'dumbbell') s += beginner ? 1.5 : 0.5
    if (WEIGHTABLE_BW.has(ex.id)) s += beginner ? 0.5 : 1.5
    if (ex.unilateral) s -= 1
  } else if (slot.role === 'secondary') {
    s += ex.mechanics === 'compound' ? 2 : 0
    s += { dumbbell: 1, machine: 0.75, barbell: 0.5, cable: 0.5, kettlebell: 0.5, bodyweight: 0, band: 0 }[ex.load]
    if (WEIGHTABLE_BW.has(ex.id)) s += 0.5
  } else {
    s += ex.mechanics === 'isolation' ? 2 : 0
  }
  // With real equipment around, prefer loadable variations (except core work, which is mostly bodyweight).
  const plainBodyweight = (ex.load === 'bodyweight' || ex.load === 'band') && !WEIGHTABLE_BW.has(ex.id) && ex.pattern !== 'core'
  if (plainBodyweight && !bodyweightGym) s -= 1
  if (REGRESSIONS.has(ex.id) && !beginner) s -= 2
  if (slot.prefer?.some((m) => ex.primary.includes(m))) s += 2
  for (const m of priorities) {
    if (ex.primary.includes(m)) s += 2
    else if (ex.secondary.includes(m)) s += 1
  }
  if (beginner && TECHNICAL.has(ex.id)) s -= 2
  if (used.has(ex.id)) s -= VARIETY_PENALTY[slot.role]
  return s
}

/** If a gym can't do a pattern at all, train the closest one instead. */
const FALLBACK: Partial<Record<Pattern, Pattern>> = {
  v_pull: 'h_pull', h_pull: 'v_pull', v_push: 'h_push', h_push: 'v_push', squat: 'lunge', lunge: 'squat', knee_iso: 'lunge',
}

function candidates(slot: Slot, pool: Exercise[]): Exercise[] {
  const match = (patterns: Pattern[]) => pool.filter((e) => patterns.includes(e.pattern) && (slot.role === 'accessory' || e.measure === 'reps'))
  let byPattern = match(slot.patterns)
  if (!byPattern.length) byPattern = match(slot.patterns.map((p) => FALLBACK[p]).filter((p): p is Pattern => !!p))
  if (!slot.prefer) return byPattern
  const preferred = byPattern.filter((e) => slot.prefer!.some((m) => e.primary.includes(m)))
  return preferred.length ? preferred : byPattern
}

function pick(slot: Slot, pool: Exercise[], input: PlanInput, used: Set<string>, bodyweightGym: boolean) {
  const ranked = candidates(slot, pool)
    .map((e) => ({ e, s: score(e, slot, input, used, bodyweightGym) }))
    .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))
  if (!ranked.length) return null
  return { exercise: ranked[0].e, alternatives: ranked.slice(1, 4).map((r) => r.e.id) }
}

function targetFor(ex: Exercise, role: Role, profile: Profile): Target {
  const t = defaultTarget(ex, profile)
  if (role === 'main' && profile.experience !== 'beginner' && (profile.intensity === 'hard' || profile.intensity === 'max')) {
    return { ...t, sets: t.sets + 1 }
  }
  return t
}

function reasonFor(ex: Exercise, slot: Slot): string {
  if (slot.reason) return slot.reason
  if (slot.role === 'main') return `Main ${PATTERN_LABELS[ex.pattern].toLowerCase()} lift of the day`
  if (slot.role === 'secondary') return `Secondary ${PATTERN_LABELS[ex.pattern].toLowerCase()} work`
  return slot.prefer ? `Targets ${slot.prefer.map(muscleLabel).join(', ')}` : `${PATTERN_LABELS[ex.pattern]} accessory`
}

export const muscleLabel = (m: Muscle) => m.replace(/_/g, ' ')

/** Minutes for a day: work + rest per set, transitions, plus a 5 min warm-up. */
export function estimateMinutes(items: { exerciseId: string; target: Target }[]): number {
  let sec = 5 * 60
  for (const { exerciseId, target } of items) {
    const ex = EXERCISE_BY_ID.get(exerciseId)
    const work = ex?.measure === 'time' ? target.repMax : target.repMax * 3 + 10
    sec += target.sets * (work + target.restSec) + 90
  }
  return Math.round(sec / 60)
}

function fitDuration(items: PlanItem[], minutes: number, priorities: Muscle[]): { items: PlanItem[]; trimmed: number } {
  const out = [...items]
  let trimmed = 0
  const isPriority = (i: PlanItem) => priorities.some((m) => EXERCISE_BY_ID.get(i.exerciseId)?.primary.includes(m))
  const dropOrder: ((i: PlanItem) => boolean)[] = [
    (i) => i.role === 'accessory' && !isPriority(i),
    (i) => i.role === 'secondary' && !isPriority(i),
    (i) => i.role === 'accessory',
  ]
  for (const match of dropOrder) {
    while (estimateMinutes(out) > minutes) {
      const idx = out.map((i) => !i.keep && match(i)).lastIndexOf(true)
      if (idx < 0) break
      out.splice(idx, 1)
      trimmed++
    }
  }
  // Still long: shave sets (never below 2).
  for (const role of ['accessory', 'secondary', 'main'] as Role[]) {
    for (const item of out) {
      if (estimateMinutes(out) <= minutes) break
      if (item.role === role && item.target.sets > 2) item.target = { ...item.target, sets: item.target.sets - 1 }
    }
  }
  return { items: out, trimmed }
}

export function weeklySets(days: PlanDay[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const d of days) for (const i of d.items) {
    const ex = EXERCISE_BY_ID.get(i.exerciseId)
    if (!ex) continue
    for (const m of ex.primary) out[m] = (out[m] ?? 0) + i.target.sets
    for (const m of ex.secondary) out[m] = (out[m] ?? 0) + i.target.sets * 0.5
  }
  return out
}

/** Weekly hard sets per muscle group (features/03-training-plan.md §2). */
export const VOLUME: Record<Experience, Record<Intensity, [min: number, max: number]>> = {
  beginner: { easy: [6, 8], moderate: [8, 10], hard: [10, 12], max: [10, 12] },
  intermediate: { easy: [8, 10], moderate: [10, 14], hard: [14, 18], max: [16, 20] },
  advanced: { easy: [10, 12], moderate: [12, 16], hard: [16, 20], max: [18, 22] },
}

const GROUPS: { name: string; muscles: Muscle[] }[] = [
  { name: 'Chest', muscles: ['chest'] },
  { name: 'Back', muscles: ['lats', 'upper_back'] },
  { name: 'Quads', muscles: ['quads'] },
  { name: 'Hamstrings', muscles: ['hamstrings'] },
  { name: 'Glutes', muscles: ['glutes'] },
]

function groupSets(days: PlanDay[], muscles: Muscle[]): number {
  let n = 0
  for (const d of days) for (const i of d.items) {
    const ex = EXERCISE_BY_ID.get(i.exerciseId)!
    if (ex.primary.some((m) => muscles.includes(m))) n += i.target.sets
    else if (ex.secondary.some((m) => muscles.includes(m))) n += i.target.sets * 0.5
  }
  return n
}

const ROLE_ORDER: Record<Role, number> = { main: 0, secondary: 1, accessory: 2 }
const MAX_SETS_PER_EXERCISE = 5

/**
 * Take one set from a non-main exercise whose muscles all stay at or above their floor, on a day that
 * has an exercise for `muscles` that can grow. Returns false if no such donor exists.
 */
function stealSet(days: PlanDay[], muscles: Muscle[], floorFor: (m: Muscle) => number): boolean {
  const weekly = weeklySets(days)
  for (const d of days) {
    const canGrow = d.items.some((i) =>
      EXERCISE_BY_ID.get(i.exerciseId)!.primary.some((m) => muscles.includes(m)) && i.target.sets < MAX_SETS_PER_EXERCISE)
    if (!canGrow) continue
    const donor = d.items
      .filter((i) => {
        const ex = EXERCISE_BY_ID.get(i.exerciseId)!
        return i.role !== 'main' && !i.keep && i.target.sets > 2 &&
          !ex.primary.some((m) => muscles.includes(m)) &&
          ex.primary.every((m) => (weekly[m] ?? 0) - 1 >= floorFor(m))
      })
      .sort((a, b) => ROLE_ORDER[b.role] - ROLE_ORDER[a.role] || b.target.sets - a.target.sets)[0]
    if (donor) {
      donor.target = { ...donor.target, sets: donor.target.sets - 1 }
      d.estMinutes = estimateMinutes(d.items)
      return true
    }
  }
  return false
}

/** Add sets to under-trained groups where time allows; trim isolation work for over-trained muscles. */
function volumeGroups(input: PlanInput, days: PlanDay[]) {
  const [floor] = VOLUME[input.profile.experience][input.profile.intensity]
  return [
    ...GROUPS,
    ...input.priorities.slice(0, 3).filter((m) => !GROUPS.some((g) => g.muscles.includes(m))).map((m) => ({ name: muscleLabel(m), muscles: [m] })),
  ]
    .filter((g) => days.some((d) => d.items.some((i) => EXERCISE_BY_ID.get(i.exerciseId)!.primary.some((m) => g.muscles.includes(m)))))
    .map((g) => ({ ...g, target: Math.round(g.muscles.some((m) => input.priorities.includes(m)) ? floor * 1.3 : floor) }))
}

/** Notes for muscle groups still under their weekly target after all adjustments. */
function volumeShortfalls(days: PlanDay[], input: PlanInput): string[] {
  return volumeGroups(input, days)
    .map((g) => ({ ...g, got: groupSets(days, g.muscles) }))
    .filter((g) => g.got < g.target)
    .map((g) => `${g.name}: ${g.got} sets/week, below the ${g.target}+ target. More days or longer sessions would help.`)
}

function balanceVolume(days: PlanDay[], input: PlanInput) {
  const [floor, ceiling] = VOLUME[input.profile.experience][input.profile.intensity]
  for (const { muscles, target } of volumeGroups(input, days)) {
    while (groupSets(days, muscles) < target) {
      const options = days.flatMap((d) => d.items
        .filter((i) => EXERCISE_BY_ID.get(i.exerciseId)!.primary.some((m) => muscles.includes(m)) && i.target.sets < MAX_SETS_PER_EXERCISE)
        .filter((i) => estimateMinutes(d.items.map((x) => (x === i ? { ...x, target: { ...x.target, sets: x.target.sets + 1 } } : x))) <= input.sessionMinutes)
        .map((i) => ({ d, i })))
        .sort((a, b) => a.i.target.sets - b.i.target.sets || ROLE_ORDER[a.i.role] - ROLE_ORDER[b.i.role])
      if (!options.length) {
        // No time left: move a set from a muscle with slack on a day that trains this group.
        if (stealSet(days, muscles, (m) => Math.round(input.priorities.includes(m) ? floor * 1.3 : floor))) continue
        break
      }
      const { d, i } = options[0]
      i.target = { ...i.target, sets: i.target.sets + 1 }
      d.estMinutes = estimateMinutes(d.items)
    }
  }
  // Over the ceiling (often triceps/front delts from all the pressing): trim isolation accessories first.
  for (const [m, sets] of Object.entries(weeklySets(days)) as [Muscle, number][]) {
    let excess = sets - ceiling
    for (const d of days) for (const i of d.items) {
      const ex = EXERCISE_BY_ID.get(i.exerciseId)!
      if (excess <= 0) break
      if (i.role === 'accessory' && ex.mechanics === 'isolation' && ex.primary.includes(m) && !i.keep) {
        const cut = Math.min(i.target.sets - 2, Math.ceil(excess))
        if (cut > 0) {
          i.target = { ...i.target, sets: i.target.sets - cut }
          excess -= cut
          d.estMinutes = estimateMinutes(d.items)
        }
      }
    }
  }
}

const PUSH: Pattern[] = ['h_push', 'v_push']
const PULL: Pattern[] = ['h_pull', 'v_pull']
const patternOf = (i: PlanItem) => EXERCISE_BY_ID.get(i.exerciseId)!.pattern

export function buildPlan(input: PlanInput): Plan {
  const exclude = new Set(input.exclude ?? [])
  const pool = performableExercises(input.equipment)
    .filter((e) => e.pattern !== 'corrective' && !exclude.has(e.id) && !isContraindicated(e.id, input.limitations))
  const bodyweightGym = !pool.some((e) => e.load !== 'bodyweight' && e.load !== 'band')
  const split = chooseSplit(input.daysPerWeek, input.profile)
  const notes: string[] = split.note ? [split.note] : []
  const used = new Set<string>()
  const priorities = input.priorities.slice(0, 3)

  // 1. Fill every slot.
  const drafts = split.templates.map((tpl) => {
    const slots = [...tpl.slots]
    // Weak points: one extra accessory per priority muscle on days that train its region.
    for (const m of priorities) {
      const region = UPPER_MUSCLES.includes(m) ? 'upper' : LOWER_MUSCLES.includes(m) ? 'lower' : 'full'
      if (tpl.region !== 'full' && region !== 'full' && region !== tpl.region) continue
      const patterns = [...new Set(pool.filter((e) => e.primary.includes(m)).map((e) => e.pattern))]
      if (patterns.length) slots.push({ patterns, role: 'accessory', prefer: [m], reason: `Priority: ${muscleLabel(m)}` })
    }

    const items: PlanItem[] = []
    const dayUsed = new Set<string>()
    for (const slot of slots) {
      const choice = pick(slot, pool.filter((e) => !dayUsed.has(e.id)), input, used, bodyweightGym)
      if (!choice) continue
      dayUsed.add(choice.exercise.id)
      used.add(choice.exercise.id)
      items.push({
        exerciseId: choice.exercise.id,
        role: slot.role,
        target: targetFor(choice.exercise, slot.role, input.profile),
        reason: reasonFor(choice.exercise, slot),
        alternatives: choice.alternatives,
        // Pulling protects the shoulders, so it is never the first thing cut for time.
        keep: PULL.includes(choice.exercise.pattern) || undefined,
      })
    }
    return { tpl, items }
  })

  // 2. Shoulder health: weekly pull sets should be at least push sets. Added before trimming so it is budgeted for.
  const count = (patterns: Pattern[]) => drafts.reduce((n, d) => n + d.items
    .filter((i) => patterns.includes(patternOf(i))).reduce((a, i) => a + i.target.sets, 0), 0)
  if (count(PUSH) > count(PULL)) {
    const balancer = ['face_pull', 'band_pull_apart', 'db_rear_delt_fly', 'reverse_pec_deck', 'inverted_row']
      .map((id) => EXERCISE_BY_ID.get(id)!)
      .find((e) => pool.includes(e))
    const day = [...drafts]
      .filter((d) => d.items.some((i) => PUSH.includes(patternOf(i))))
      .sort((a, b) => estimateMinutes(a.items) - estimateMinutes(b.items))[0]
    if (balancer && day && !day.items.some((i) => i.exerciseId === balancer.id)) {
      day.items.push({
        exerciseId: balancer.id, role: 'accessory', target: targetFor(balancer, 'accessory', input.profile),
        reason: 'Balances your pushing with pulling, for shoulder health', alternatives: [], keep: true,
      })
    }
  }

  // 3. Fit each day into the session length.
  const days: PlanDay[] = drafts.map(({ tpl, items }) => {
    const fitted = fitDuration(items, input.sessionMinutes, priorities)
    if (fitted.trimmed) notes.push(`${tpl.name}: dropped ${fitted.trimmed} exercise${fitted.trimmed > 1 ? 's' : ''} to fit ${input.sessionMinutes} min.`)
    return { name: tpl.name, items: fitted.items, estMinutes: estimateMinutes(fitted.items) }
  })

  // 4. Weekly volume per muscle group.
  balanceVolume(days, input)

  // 5. Volume top-ups can tip the push/pull balance again: add pull sets where time allows, else trim push.
  const weekSets = (patterns: Pattern[]) => days.reduce((n, d) => n + d.items
    .filter((i) => patterns.includes(patternOf(i)) || (patterns === PULL && i.reason.startsWith('Balances')))
    .reduce((a, i) => a + i.target.sets, 0), 0)
  for (let guard = 0; guard < 40 && weekSets(PUSH) > weekSets(PULL); guard++) {
    const fits = (d: PlanDay, i: PlanItem) =>
      estimateMinutes(d.items.map((x) => (x === i ? { ...x, target: { ...x.target, sets: x.target.sets + 1 } } : x))) <= input.sessionMinutes
    const pullItem = days.flatMap((d) => d.items
      .filter((i) => (PULL.includes(patternOf(i)) || i.reason.startsWith('Balances')) && i.target.sets < MAX_SETS_PER_EXERCISE && fits(d, i))
      .map((i) => ({ d, i })))
      .sort((a, b) => a.i.target.sets - b.i.target.sets)[0]
    if (pullItem) {
      pullItem.i.target = { ...pullItem.i.target, sets: pullItem.i.target.sets + 1 }
      pullItem.d.estMinutes = estimateMinutes(pullItem.d.items)
      continue
    }
    const pushItem = days.flatMap((d) => d.items.filter((i) => PUSH.includes(patternOf(i)) && i.target.sets > 2).map((i) => ({ d, i })))
      .sort((a, b) => ROLE_ORDER[b.i.role] - ROLE_ORDER[a.i.role] || b.i.target.sets - a.i.target.sets)[0]
    if (!pushItem) break
    pushItem.i.target = { ...pushItem.i.target, sets: pushItem.i.target.sets - 1 }
    pushItem.d.estMinutes = estimateMinutes(pushItem.d.items)
  }

  notes.push(...volumeShortfalls(days, input))

  if (input.limitations.length) {
    const excluded = EXERCISES.filter((e) => isContraindicated(e.id, input.limitations)).length
    notes.push(`${excluded} exercises left out because of your limitations. If pain worsens or lasts, see a physiotherapist.`)
  }

  return { splitName: split.name, days, weeklySets: weeklySets(days), notes }
}

/** Swap plan exercises that aren't possible at the current gym for the best possible alternative. */
export function substituteForGym(item: PlanItem, equipment: string[], limitations: Area[]): string | null {
  const possible = new Set(performableExercises(equipment).map((e) => e.id))
  if (possible.has(item.exerciseId)) return item.exerciseId
  const alt = item.alternatives.find((id) => possible.has(id) && !isContraindicated(id, limitations))
  if (alt) return alt
  const ex = EXERCISE_BY_ID.get(item.exerciseId)
  const same = [...possible]
    .map((id) => EXERCISE_BY_ID.get(id)!)
    .filter((e) => e.pattern === ex?.pattern && !isContraindicated(e.id, limitations))
    .sort((a, b) => Number(b.mechanics === ex?.mechanics) - Number(a.mechanics === ex?.mechanics) || a.id.localeCompare(b.id))
  return same[0]?.id ?? null
}
