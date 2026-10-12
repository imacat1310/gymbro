// Camera-angle labels and setup instructions for the form check.
import type { FormView } from './types'

export const VIEW_INFO: Record<FormView, { title: string; how: string; checks: string }> = {
  side: { title: 'Side view', how: 'Phone at hip height, about 3 m away, your side facing it.', checks: 'Depth, torso lean, heels, tempo' },
  front: { title: 'Front view', how: 'Phone at hip height, about 3 m away, facing you.', checks: 'Knees tracking, side-to-side shift' },
}
