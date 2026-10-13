// A labelled form-check sample for tuning (ADR-022): body points + the profile used + what really happened.
// Shared by the app (Share for tuning) and the Mac evaluation tool (tools/form-eval). No video, ever.
import type { FaultCode, FormProfile, FormReport, FormView, Recording } from './types'

export const SAMPLE_FORMAT = 'gymbro-form-sample'

/** Faults each camera angle can judge, so labelling only offers those. */
export const VIEW_FAULTS: Record<FormView, FaultCode[]> = {
  side: ['shallow', 'forward_lean', 'heel_rise', 'fast_descent'],
  front: ['knee_cave', 'hip_shift'],
}

export interface SampleLabels {
  /** The true number of reps, when the analysis counted wrong. */
  reps?: number
  /** Per detected rep (1-based): faults that really happened. A labelled rep with an empty list was good. */
  perRep?: Record<number, FaultCode[]>
  /** Faults anywhere in the clip, for datasets labelled per clip rather than per rep. */
  clip?: FaultCode[]
}

export interface FormSample {
  format: typeof SAMPLE_FORMAT
  version: 1
  appVersion: string
  createdAt: string
  recording: Recording
  profile: FormProfile
  labels?: SampleLabels
  /** What the app said at the time, for reference (the evaluator re-runs the analysis). */
  detected?: { reps: number; faults: { code: FaultCode; reps: number[] }[]; score: number }
}

export function makeSample(recording: Recording, profile: FormProfile, report: FormReport | null, labels: SampleLabels | undefined, appVersion: string): FormSample {
  return {
    format: SAMPLE_FORMAT, version: 1, appVersion, createdAt: new Date().toISOString(),
    recording, profile, labels,
    detected: report && !report.error
      ? { reps: report.reps.length, faults: report.faults.map((f) => ({ code: f.code, reps: f.reps })), score: report.score }
      : undefined,
  }
}

export const isSample = (x: unknown): x is FormSample =>
  !!x && typeof x === 'object' && (x as { format?: unknown }).format === SAMPLE_FORMAT && !!(x as FormSample).recording?.frames
