// Rep segmentation from hip drop (share of leg length below standing). Works from the side and the front.

export interface RepWindow {
  /** Frame indices: descent start, deepest point, ascent end. */
  start: number
  bottom: number
  end: number
  /** First frame at 95% of this rep's depth, and last one before rising below it: tempo boundaries. */
  reachBottom: number
  leaveBottom: number
}

/** Tempo is measured between 5% and 95% of each rep's own depth, so slow starts and pauses don't blur it. */
const TEMPO_EDGE = 0.05

export const REP_DOWN = 0.25
export const REP_UP = 0.08
/** Tempo boundaries use a tighter "standing" band than rep detection. */
export const STILL = 0.03
const MIN_REP_MS = 600

/**
 * State machine with hysteresis: a rep is a drop past REP_DOWN followed by a return above REP_UP.
 * Half reps that never reach REP_DOWN aren't counted.
 */
export function detectReps(drop: number[], times: number[]): RepWindow[] {
  const reps: RepWindow[] = []
  let down = false
  let lastTop = 0
  let bottom = 0
  for (let i = 0; i < drop.length; i++) {
    if (!down) {
      if (drop[i] < REP_UP) lastTop = i
      if (drop[i] > REP_DOWN) { down = true; bottom = i }
    } else {
      if (drop[i] > drop[bottom]) bottom = i
      if (drop[i] < REP_UP) {
        const depth = drop[bottom]
        let start = bottom
        while (start > lastTop && drop[start - 1] > STILL) start--
        let end = bottom
        while (end < drop.length - 1 && drop[end] > STILL) end++
        let reachBottom = bottom
        while (reachBottom > start && drop[reachBottom - 1] >= depth * (1 - TEMPO_EDGE)) reachBottom--
        let leaveBottom = bottom
        while (leaveBottom < end && drop[leaveBottom + 1] >= depth * (1 - TEMPO_EDGE)) leaveBottom++
        let moveStart = start
        while (moveStart < reachBottom && drop[moveStart] < depth * TEMPO_EDGE) moveStart++
        let moveEnd = end
        while (moveEnd > leaveBottom && drop[moveEnd] < depth * TEMPO_EDGE) moveEnd--
        if (times[end] - times[start] >= MIN_REP_MS) reps.push({ start: moveStart, bottom, end: moveEnd, reachBottom, leaveBottom })
        down = false
        lastTop = i
      }
    }
  }
  return reps
}
