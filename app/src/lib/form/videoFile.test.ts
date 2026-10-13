import { describe, expect, it } from 'vitest'
import { MAX_VIDEO_SEC, sampleTimes, VIDEO_FPS } from './videoFile'

describe('sampleTimes', () => {
  it('samples at the live frame rate', () => {
    const t = sampleTimes(2)
    expect(t).toHaveLength(2 * VIDEO_FPS)
    expect(t[1] - t[0]).toBeCloseTo(1 / VIDEO_FPS)
  })
  it('caps long videos', () => {
    expect(sampleTimes(600)).toHaveLength(MAX_VIDEO_SEC * VIDEO_FPS)
  })
  it('handles empty or broken durations', () => {
    expect(sampleTimes(0)).toEqual([])
    expect(sampleTimes(Number.NaN)).toEqual([])
  })
})
