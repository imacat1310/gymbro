// Squat form analysis v1 (ADR-022). Side view: depth, torso lean against a personal limit, heel rise, tempo,
// fatigue breakdown. Front view: knee cave against the user's own standing alignment, sideways hip shift.
// Thresholds marked "assumption" are starting points to tune against labelled recordings.
import { LM } from '../pose'
import { DEG, dist, median, mid, px, r1, smooth, type Px } from './geometry'
import { detectReps, STILL, type RepWindow } from './reps'
import { BLOCK_BELOW, formScore, rankFaults, repList } from './score'
import type { Fault, FormProfile, FormReport, RepMetrics, Recording } from './types'

const MIN_VIS = 0.5
const MIN_USABLE_SHARE = 0.6
const MIN_FRAMES = 20

/**
 * Thresholds. All are starting assumptions, to be tuned against labelled recordings with the evaluation tool
 * (tools/form-eval). Passing a different set changes the judgement only, never the measurements.
 */
export interface SquatThresholds {
  /** Depth: thigh this many degrees above parallel is "shallow" (mild / moderate). */
  shallow: { mild: number; moderate: number }
  /** Lean limit at the bottom for an average build, and how it scales with femur ÷ torso (long femurs lean more). */
  leanBase: number
  leanPerRatio: number
  leanRefRatio: number
  leanRange: [min: number, max: number]
  leanOver: { mild: number; moderate: number }
  lowerBackStricter: number
  /** Heel lift as a share of leg length. */
  heel: { mild: number; moderate: number }
  /**
   * Active lowering (5%→95% of hip drop) faster than this is "dropping", in seconds. Hip height barely moves at the
   * start of a squat, so this is about half the felt descent time: 0.5 s ≈ a 1-second descent.
   */
  fastDescent: number
  /** Last reps worse than the first by this much = fatigue breakdown. */
  fatigue: { depth: number; lean: number; minReps: number }
  /** Knee cave beyond standing alignment, degrees; stricter when the posture scan found static valgus. */
  cave: { mild: number; moderate: number }
  caveWatched: { mild: number; moderate: number }
  /** Sideways hip shift at the bottom, share of hip width. */
  shift: { mild: number; moderate: number }
}

export const DEFAULT_SQUAT_THRESHOLDS: SquatThresholds = {
  shallow: { mild: -5, moderate: -15 },
  leanBase: 45,
  leanPerRatio: 50,
  leanRefRatio: 0.9,
  leanRange: [38, 60],
  leanOver: { mild: 5, moderate: 12 },
  lowerBackStricter: 5,
  heel: { mild: 0.03, moderate: 0.06 },
  fastDescent: 0.5,
  fatigue: { depth: 10, lean: 8, minReps: 4 },
  cave: { mild: 8, moderate: 14 },
  caveWatched: { mild: 6, moderate: 12 },
  shift: { mild: 0.15, moderate: 0.25 },
}

/** Personal lean limit (degrees from vertical) from body proportions and injuries. */
export function leanLimit(profile: FormProfile, t: SquatThresholds = DEFAULT_SQUAT_THRESHOLDS): number {
  const ratio = profile.femurTorso ?? t.leanRefRatio
  const limit = Math.max(t.leanRange[0], Math.min(t.leanRange[1], t.leanBase + (ratio - t.leanRefRatio) * t.leanPerRatio))
  return Math.round(profile.limitations.includes('lower_back') ? limit - t.lowerBackStricter : limit)
}

type Side = 'left' | 'right'
const IDX = {
  left: { sh: LM.leftShoulder, hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle, heel: LM.leftHeel, toe: LM.leftFootIndex },
  right: { sh: LM.rightShoulder, hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle, heel: LM.rightHeel, toe: LM.rightFootIndex },
}

interface Pts { sh: Px; hip: Px; knee: Px; ankle: Px; heel: Px; toe: Px }

export function analyzeSquat(rec: Recording, profile: FormProfile, t: SquatThresholds = DEFAULT_SQUAT_THRESHOLDS): FormReport {
  const { width: w, height: h, view } = rec
  const base: Pick<FormReport, 'exerciseId' | 'view'> = { exerciseId: rec.exerciseId, view }
  const notMeasured = view === 'side'
    ? ['Lower-back rounding ("butt wink") and bar path aren\'t measured yet.', 'Knee tracking needs a front-view recording.']
    : ['Depth, torso lean and heels need a side-view recording.']
  const empty = (error: FormReport['error']): FormReport =>
    ({ ...base, reps: [], faults: [], score: 0, tips: [], notMeasured, personal: [], error })

  const side = (s: Side, f: { lms: Recording['frames'][number]['lms'] }): Pts => {
    const i = IDX[s]
    return { sh: px(f.lms[i.sh], w, h), hip: px(f.lms[i.hip], w, h), knee: px(f.lms[i.knee], w, h), ankle: px(f.lms[i.ankle], w, h), heel: px(f.lms[i.heel], w, h), toe: px(f.lms[i.toe], w, h) }
  }
  const vis = (p: Pts, keys: (keyof Pts)[]) => Math.min(...keys.map((k) => p[k].v))

  // Side view: analyse the side nearer the camera (better visibility).
  const visSum = (s: Side) => rec.frames.reduce((a, f) => a + vis(side(s, f), ['hip', 'knee', 'ankle']), 0)
  const near: Side = visSum('left') >= visSum('right') ? 'left' : 'right'
  const needed: (keyof Pts)[] = ['sh', 'hip', 'knee', 'ankle']

  const frames = rec.frames.filter((f) => view === 'side'
    ? vis(side(near, f), needed) >= MIN_VIS
    : Math.min(vis(side('left', f), needed), vis(side('right', f), needed)) >= MIN_VIS)
  if (frames.length < MIN_FRAMES || frames.length < rec.frames.length * MIN_USABLE_SHARE) return empty('not_visible')

  const L = frames.map((f) => side('left', f))
  const R = frames.map((f) => side('right', f))
  const N = view === 'side' ? frames.map((f) => side(near, f)) : []
  const hipY = frames.map((_, i) => (view === 'side' ? N[i].hip.y : mid(L[i].hip, R[i].hip).y))
  // Standing = the highest hip positions (robust even if the recording starts mid-rep).
  const standHip = [...hipY].sort((a, b) => a - b)[Math.floor(hipY.length * 0.1)]
  const legLens = frames.map((_, i) => (view === 'side' ? dist(N[i].hip, N[i].ankle) : (dist(L[i].hip, L[i].ankle) + dist(R[i].hip, R[i].ankle)) / 2))
  const legLen = median(legLens.filter((_, i) => hipY[i] - standHip < 0.05 * legLens[i])) || median(legLens)
  const drop = smooth(hipY.map((y) => (y - standHip) / legLen))
  const times = frames.map((f) => f.t)
  const windows = detectReps(drop, times)
  if (!windows.length) return empty('no_reps')
  const standing = drop.map((d, i) => (d < STILL ? i : -1)).filter((i) => i >= 0)

  const around = (i: number) => [i - 2, i - 1, i, i + 1, i + 2].filter((j) => j >= 0 && j < frames.length)
  const avgAt = (i: number, fn: (j: number) => number) => { const js = around(i); return js.reduce((a, j) => a + fn(j), 0) / js.length }

  // Per-rep metrics.
  const depthAt = (j: number) => Math.atan2(N[j].hip.y - N[j].knee.y, Math.abs(N[j].hip.x - N[j].knee.x)) * DEG
  const leanAt = (j: number) => Math.atan2(Math.abs(N[j].sh.x - N[j].hip.x), N[j].hip.y - N[j].sh.y) * DEG
  const heelBase = view === 'side' ? median(standing.map((j) => N[j].heel.y)) : 0
  const heelOk = view === 'side' && N.filter((p) => p.heel.v >= MIN_VIS).length >= frames.length * MIN_USABLE_SHARE

  /** Inward knee offset from the hip–ankle line, toward the body's midline, as an angle over half the leg. */
  const caveAt = (j: number, s: Side) => {
    const p = s === 'left' ? L[j] : R[j]
    const midX = mid(L[j].hip, R[j].hip).x
    const tY = (p.knee.y - p.hip.y) / ((p.ankle.y - p.hip.y) || 1)
    const lineX = p.hip.x + (p.ankle.x - p.hip.x) * tY
    const inward = Math.abs(lineX - midX) - Math.abs(p.knee.x - midX)
    return Math.atan2(inward, legLen / 2) * DEG
  }
  const caveBase = view === 'front' ? { left: median(standing.map((j) => caveAt(j, 'left'))), right: median(standing.map((j) => caveAt(j, 'right'))) } : { left: 0, right: 0 }
  /** Hip centre relative to ankle centre, + toward the user's left, in hip widths. */
  const shiftAt = (j: number) => {
    const dir = Math.sign(L[j].ankle.x - R[j].ankle.x) || 1
    const hipW = Math.abs(L[j].hip.x - R[j].hip.x) || 1
    return ((mid(L[j].hip, R[j].hip).x - mid(L[j].ankle, R[j].ankle).x) * dir) / hipW
  }
  const shiftBase = view === 'front' ? median(standing.map(shiftAt)) : 0

  const reps: RepMetrics[] = windows.map((win: RepWindow, k) => {
    const m: RepMetrics = {
      rep: k + 1, startT: times[win.start], bottomT: times[win.bottom], endT: times[win.end],
      descentSec: r1((times[win.reachBottom] - times[win.start]) / 1000) || 0,
      ascentSec: r1((times[win.end] - times[win.leaveBottom]) / 1000) || 0,
    }
    if (view === 'side') {
      m.depthDeg = r1(avgAt(win.bottom, depthAt))
      m.leanDeg = r1(avgAt(win.bottom, leanAt))
      if (heelOk) {
        let rise = 0
        for (let j = win.start; j <= win.end; j++) if (N[j].heel.v >= MIN_VIS) rise = Math.max(rise, (heelBase - N[j].heel.y) / legLen)
        m.heelRise = Math.round(rise * 1000) / 1000
      }
    } else {
      const bent: number[] = []
      for (let j = win.start; j <= win.end; j++) if (drop[j] > 0.15) bent.push(j)
      const worst = (s: Side) => Math.max(0, ...bent.map((j) => caveAt(j, s) - caveBase[s]))
      m.kneeCaveDeg = { left: r1(worst('left')), right: r1(worst('right')) }
      m.hipShift = Math.round((avgAt(win.bottom, shiftAt) - shiftBase) * 100) / 100
    }
    return m
  })

  const { faults, personal } = view === 'side' ? sideFaults(reps, profile, t) : frontFaults(reps, profile, t)
  const ranked = rankFaults(faults)
  const score = formScore(ranked, reps.length)
  const safety = ranked.find((f) => f.severity === 'safety')
  const tips = ranked.length
    ? ranked.slice(0, 2).map((f) => ({ text: f.tip, why: f.why }))
    : [{ text: `Solid set: ${reps.length} rep${reps.length > 1 ? 's' : ''} with consistent ${view === 'side' ? 'depth and position' : 'knee and hip alignment'}.` }]
  const fatigue = ranked.find((f) => f.code === 'fatigue_breakdown')
  const blockIncrease = safety ? safety.tip
    : score < BLOCK_BELOW ? `Form score ${score} is below ${BLOCK_BELOW}: own this weight before adding more.`
      : fatigue ? fatigue.tip : undefined

  return { ...base, reps, faults: ranked, score, tips, blockIncrease, notMeasured, personal }
}

function sideFaults(reps: RepMetrics[], profile: FormProfile, t: SquatThresholds): { faults: Fault[]; personal: string[] } {
  const faults: Fault[] = []
  const personal: string[] = []
  const knee = profile.limitations.includes('knee')
  const lowerBack = profile.limitations.includes('lower_back')
  const limit = leanLimit(profile, t)
  const longFemurs = (profile.femurTorso ?? 0) >= 1.0

  if (profile.femurTorso !== undefined) {
    personal.push(`Lean limit ${limit}° from your thigh-to-torso ratio (${profile.femurTorso})${lowerBack ? ', 5° stricter for your lower back' : ''}.`)
  } else if (lowerBack) {
    personal.push(`Lean limit ${limit}°: 5° stricter for your lower back.`)
  }
  if (knee) personal.push('Depth isn\'t pushed because of your knee.')

  // Depth
  const shallow = reps.filter((r) => (r.depthDeg ?? 0) < t.shallow.mild)
  if (shallow.length && !knee) {
    const worst = Math.min(...shallow.map((r) => r.depthDeg!))
    faults.push({
      code: 'shallow', severity: worst < t.shallow.moderate ? 'moderate' : 'mild', reps: shallow.map((r) => r.rep),
      value: worst, unit: '°',
      tip: `Sit a little deeper: aim for your hip crease level with your knees (${repList(shallow.map((r) => r.rep))} stopped ${Math.abs(Math.round(worst))}° above parallel).`,
    })
  }

  // Torso lean against the personal limit
  const leaning = reps.filter((r) => (r.leanDeg ?? 0) > limit + (lowerBack ? 0 : t.leanOver.mild))
  if (leaning.length) {
    const worst = Math.max(...leaning.map((r) => r.leanDeg!))
    const severity = lowerBack ? 'safety' : worst > limit + t.leanOver.moderate ? 'moderate' : 'mild'
    const tip = lowerBack
      ? `Your torso leaned to ${Math.round(worst)}° on ${repList(leaning.map((r) => r.rep))}. With your lower-back history, end the set there and lower the weight.`
      : longFemurs
        ? `You leaned to ${Math.round(worst)}°, past what your build needs. Try a slightly wider stance or small plates under your heels, and brace before you go down.`
        : `Keep your chest up and brace harder: your torso leaned to ${Math.round(worst)}° (your limit is ${limit}°).`
    faults.push({
      code: 'forward_lean', severity, reps: leaning.map((r) => r.rep), value: worst, unit: '°', tip,
      why: profile.femurTorso !== undefined
        ? `Your thighs are ${longFemurs ? 'long' : 'average or short'} relative to your torso (ratio ${profile.femurTorso} from your posture scan), so your lean limit is ${limit}°${longFemurs ? ': some forward lean is normal for you' : ''}.`
        : lowerBack ? 'Your lower-back limitation makes leaning a safety issue for you.' : undefined,
    })
  }

  // Heels
  const heels = reps.filter((r) => (r.heelRise ?? 0) > t.heel.mild)
  if (heels.length) {
    const worst = Math.max(...heels.map((r) => r.heelRise!))
    faults.push({
      code: 'heel_rise', severity: worst > t.heel.moderate ? 'moderate' : 'mild', reps: heels.map((r) => r.rep), value: worst, unit: '× leg',
      tip: `Keep your weight mid-foot: your heels lifted on ${repList(heels.map((r) => r.rep))}. If your ankles are stiff, small plates under your heels help.`,
    })
  }

  // Tempo
  const fast = reps.filter((r) => r.descentSec > 0 && r.descentSec < t.fastDescent)
  if (fast.length) {
    const worst = Math.min(...fast.map((r) => r.descentSec))
    faults.push({
      code: 'fast_descent', severity: 'mild', reps: fast.map((r) => r.rep), value: worst, unit: 's',
      // No seconds in the text: the measured active lowering is shorter than the descent the lifter feels.
      tip: `Control the way down: you dropped quickly on ${repList(fast.map((r) => r.rep))}. Take about 2 seconds to lower.`,
    })
  }

  // Fatigue: last two reps vs first two
  if (reps.length >= t.fatigue.minReps) {
    const avg = (rs: RepMetrics[], k: 'depthDeg' | 'leanDeg') => rs.reduce((a, r) => a + (r[k] ?? 0), 0) / rs.length
    const first = reps.slice(0, 2), last = reps.slice(-2)
    const depthLoss = avg(first, 'depthDeg') - avg(last, 'depthDeg')
    const leanGain = avg(last, 'leanDeg') - avg(first, 'leanDeg')
    if ((depthLoss > t.fatigue.depth && !knee) || leanGain > t.fatigue.lean) {
      faults.push({
        code: 'fatigue_breakdown', severity: 'mild', reps: last.map((r) => r.rep),
        value: r1(depthLoss > t.fatigue.depth ? depthLoss : leanGain), unit: '°',
        tip: `Your ${depthLoss > t.fatigue.depth ? 'depth' : 'position'} slipped on the last reps: that's fatigue. Stay at this weight next time.`,
      })
    }
  }
  return { faults, personal }
}

function frontFaults(reps: RepMetrics[], profile: FormProfile, t: SquatThresholds): { faults: Fault[]; personal: string[] } {
  const faults: Fault[] = []
  const personal: string[] = []
  const cave = profile.staticValgus ? t.caveWatched : t.cave
  if (profile.staticValgus) personal.push('Knee tracking is checked more closely: your posture scan showed your knees angling in when standing.')
  if (profile.weakLeg) personal.push(`Your ${profile.weakLeg.side} leg has ${profile.weakLeg.diffPct}% less lean mass (InBody), so side-to-side shift is watched.`)

  const caving = reps.filter((r) => Math.max(r.kneeCaveDeg!.left, r.kneeCaveDeg!.right) > cave.mild)
  if (caving.length) {
    const worst = Math.max(...caving.map((r) => Math.max(r.kneeCaveDeg!.left, r.kneeCaveDeg!.right)))
    const left = caving.filter((r) => r.kneeCaveDeg!.left > cave.mild).length
    const right = caving.filter((r) => r.kneeCaveDeg!.right > cave.mild).length
    const which = left && right ? 'Both knees' : left ? 'Your left knee' : 'Your right knee'
    faults.push({
      code: 'knee_cave', severity: worst > cave.moderate ? 'moderate' : 'mild', reps: caving.map((r) => r.rep), value: worst, unit: '°',
      tip: `${which} moved in on ${repList(caving.map((r) => r.rep))}. Push your knees out over your toes, especially on the way up.`,
      why: profile.staticValgus
        ? 'Your posture scan showed your knees angling in when standing, so this is watched more closely. Banded lateral walks in your warm-up train the hip muscles that hold the knee out.'
        : undefined,
    })
  }

  const shifting = reps.filter((r) => Math.abs(r.hipShift ?? 0) > t.shift.mild)
  if (shifting.length) {
    const worst = shifting.reduce((a, r) => (Math.abs(r.hipShift!) > Math.abs(a) ? r.hipShift! : a), 0)
    const toward = worst > 0 ? 'left' : 'right'
    const away = toward === 'left' ? 'right' : 'left'
    const weakIsAway = profile.weakLeg?.side === away
    faults.push({
      code: 'hip_shift', severity: Math.abs(worst) > t.shift.moderate ? 'moderate' : 'mild', reps: shifting.map((r) => r.rep),
      value: Math.round(Math.abs(worst) * 100), unit: '% hip width',
      tip: weakIsAway
        ? `You shift onto your ${toward} leg at the bottom. Start your single-leg work with your ${away} leg and lighten the load until you can stay centred.`
        : `You shift onto your ${toward} leg at the bottom. Keep your weight even over both feet; lighten the load if needed.`,
      why: weakIsAway ? `Your ${away} leg has ${profile.weakLeg!.diffPct}% less lean mass (InBody), so you favour the other side.` : undefined,
    })
  }
  return { faults, personal }
}
