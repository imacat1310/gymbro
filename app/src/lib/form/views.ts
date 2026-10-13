// Camera-angle labels and setup instructions for the form check.
import type { FaultCode, FormView } from './types'

export const VIEW_INFO: Record<FormView, { title: string; how: string; checks: string }> = {
  side: { title: 'Side view', how: 'Phone at hip height, about 3 m away, your side facing it.', checks: 'Depth, torso lean, heels, tempo' },
  front: { title: 'Front view', how: 'Phone at hip height, about 3 m away, facing you.', checks: 'Knees tracking, side-to-side shift' },
}

export const FAULT_TITLE: Record<FaultCode, string> = {
  shallow: 'Depth above parallel', forward_lean: 'Torso lean', heel_rise: 'Heels lifting', fast_descent: 'Fast descent',
  fatigue_breakdown: 'Form slipping late in the set', knee_cave: 'Knees moving in', hip_shift: 'Shifting to one side',
}
