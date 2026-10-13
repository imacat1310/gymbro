// Form-check evaluation (ADR-022): re-run the analysis on labelled samples and measure each fault's accuracy,
// then sweep thresholds to find better values. Pure; used by evaluate.eval.ts and its unit test.
import { VIEW_FAULTS, type FormSample } from '../../src/lib/form/sample'
import { analyzeSquat, DEFAULT_SQUAT_THRESHOLDS, type SquatThresholds } from '../../src/lib/form/squat'
import type { FaultCode } from '../../src/lib/form/types'

export interface Confusion { tp: number; fp: number; fn: number; tn: number }
export interface FaultScore extends Confusion { precision: number; recall: number; f1: number; positives: number; negatives: number }

export interface Evaluation {
  samples: number
  labelled: number
  /** Samples whose true rep count is known. */
  repCount: { samples: number; exact: number; meanAbsError: number }
  faults: Partial<Record<FaultCode, FaultScore>>
  /** Samples that couldn't be analysed (not visible / no reps). */
  unusable: number
}

const score = (c: Confusion): FaultScore => {
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 0
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  return { ...c, precision, recall, f1, positives: c.tp + c.fn, negatives: c.tn + c.fp }
}

export function evaluate(samples: FormSample[], t: SquatThresholds = DEFAULT_SQUAT_THRESHOLDS): Evaluation {
  const conf: Partial<Record<FaultCode, Confusion>> = {}
  const add = (f: FaultCode, truth: boolean, pred: boolean) => {
    const c = (conf[f] ??= { tp: 0, fp: 0, fn: 0, tn: 0 })
    if (truth && pred) c.tp++
    else if (!truth && pred) c.fp++
    else if (truth && !pred) c.fn++
    else c.tn++
  }
  let labelled = 0, unusable = 0
  const countErr: number[] = []

  for (const s of samples) {
    const report = analyzeSquat(s.recording, s.profile, t)
    if (report.error) { unusable++; continue }
    const labels = s.labels
    if (!labels) continue
    labelled++
    const trueReps = labels.reps ?? (labels.perRep ? Object.keys(labels.perRep).length : undefined)
    if (trueReps !== undefined) countErr.push(Math.abs(report.reps.length - trueReps))
    const faults = VIEW_FAULTS[s.recording.view]
    if (labels.perRep) {
      for (const [repStr, truthList] of Object.entries(labels.perRep)) {
        const rep = Number(repStr)
        if (rep > report.reps.length) continue
        for (const f of faults) add(f, truthList.includes(f), report.faults.some((x) => x.code === f && x.reps.includes(rep)))
      }
    } else if (labels.clip) {
      for (const f of faults) add(f, labels.clip.includes(f), report.faults.some((x) => x.code === f))
    }
  }

  return {
    samples: samples.length, labelled, unusable,
    repCount: {
      samples: countErr.length,
      exact: countErr.filter((e) => e === 0).length,
      meanAbsError: countErr.length ? countErr.reduce((a, b) => a + b, 0) / countErr.length : 0,
    },
    faults: Object.fromEntries(Object.entries(conf).map(([f, c]) => [f, score(c!)])),
  }
}

/** One adjustable threshold per fault: its "mild" (fault/no fault) boundary. Moderate keeps its gap above it. */
export const SWEEPS: Partial<Record<FaultCode, { label: string; values: number[]; apply: (t: SquatThresholds, v: number) => SquatThresholds; current: (t: SquatThresholds) => number }>> = {
  shallow: {
    label: 'shallow.mild (° vs parallel)', values: range(-15, 5, 1),
    apply: (t, v) => ({ ...t, shallow: { mild: v, moderate: Math.min(t.shallow.moderate, v - 10) } }), current: (t) => t.shallow.mild,
  },
  forward_lean: {
    label: 'leanOver.mild (° over personal limit)', values: range(-5, 15, 1),
    apply: (t, v) => ({ ...t, leanOver: { mild: v, moderate: Math.max(t.leanOver.moderate, v + 7) } }), current: (t) => t.leanOver.mild,
  },
  heel_rise: {
    label: 'heel.mild (× leg length)', values: range(0.01, 0.08, 0.005),
    apply: (t, v) => ({ ...t, heel: { mild: v, moderate: Math.max(t.heel.moderate, v + 0.03) } }), current: (t) => t.heel.mild,
  },
  fast_descent: {
    label: 'fastDescent (s active lowering)', values: range(0.2, 1, 0.05),
    apply: (t, v) => ({ ...t, fastDescent: v }), current: (t) => t.fastDescent,
  },
  knee_cave: {
    label: 'cave.mild (°; watched = −2)', values: range(2, 16, 1),
    apply: (t, v) => ({ ...t, cave: { mild: v, moderate: Math.max(t.cave.moderate, v + 6) }, caveWatched: { mild: v - 2, moderate: Math.max(t.caveWatched.moderate, v + 4) } }),
    current: (t) => t.cave.mild,
  },
  hip_shift: {
    label: 'shift.mild (× hip width)', values: range(0.05, 0.4, 0.025),
    apply: (t, v) => ({ ...t, shift: { mild: v, moderate: Math.max(t.shift.moderate, v + 0.1) } }), current: (t) => t.shift.mild,
  },
}

export interface SweepResult {
  fault: FaultCode
  label: string
  current: number
  currentF1: number
  best: number
  bestF1: number
  /** Too few labelled positives or negatives to trust a change. */
  enoughData: boolean
}

/** Minimum labelled reps on each side (fault / no fault) before a threshold change is suggested. */
export const MIN_SUPPORT = 5

export function sweep(samples: FormSample[], base: SquatThresholds = DEFAULT_SQUAT_THRESHOLDS): SweepResult[] {
  const baseline = evaluate(samples, base)
  const out: SweepResult[] = []
  for (const [fault, spec] of Object.entries(SWEEPS) as [FaultCode, NonNullable<(typeof SWEEPS)[FaultCode]>][]) {
    const now = baseline.faults[fault]
    if (!now) continue
    const current = spec.current(base)
    let best = current, bestF1 = now.f1
    for (const v of spec.values) {
      const f1 = evaluate(samples, spec.apply(base, v)).faults[fault]?.f1 ?? 0
      // Strictly better, or equal and closer to the current value (don't move without a reason).
      if (f1 > bestF1 + 1e-9 || (Math.abs(f1 - bestF1) < 1e-9 && Math.abs(v - current) < Math.abs(best - current))) { best = v; bestF1 = f1 }
    }
    out.push({ fault, label: spec.label, current, currentF1: now.f1, best: +best.toFixed(3), bestF1, enoughData: now.positives >= MIN_SUPPORT && now.negatives >= MIN_SUPPORT })
  }
  return out
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = from; v <= to + step / 2; v += step) out.push(+v.toFixed(4))
  return out
}
