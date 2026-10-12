// The analyser for each exercise with a form check (ADR-022: squat first).
import { analyzeSquat } from './squat'
import { supportsFormCheck } from './supported'
import type { FormProfile, FormReport, Recording } from './types'

export { supportsFormCheck }

export function analyzeForm(rec: Recording, profile: FormProfile): FormReport {
  if (!supportsFormCheck(rec.exerciseId)) throw new Error(`No form check for ${rec.exerciseId}`)
  return analyzeSquat(rec, profile)
}
