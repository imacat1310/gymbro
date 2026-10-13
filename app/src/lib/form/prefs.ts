// Per-device convenience: remember the last camera angle used for form checks. Storage can be unavailable
// (private mode, cleared site data), so every access is guarded and falls back to the side view.
import type { FormView } from './types'

const KEY = 'gymbro.formView'

export function lastFormView(): FormView {
  try {
    return localStorage.getItem(KEY) === 'front' ? 'front' : 'side'
  } catch {
    return 'side'
  }
}

export function rememberFormView(view: FormView) {
  try {
    localStorage.setItem(KEY, view)
  } catch {
    // Not remembered; harmless.
  }
}
