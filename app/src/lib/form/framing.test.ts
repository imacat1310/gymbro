import { describe, expect, it } from 'vitest'
import { squatRecording } from '../fixtures/squat'
import { framingHint } from './framing'

const first = (view: 'side' | 'front', visibility?: number) => squatRecording({ view, reps: 1, visibility }).frames[0].lms

describe('framingHint', () => {
  it('ready when the whole body is in view and facing the right way', () => {
    expect(framingHint(first('side'), 'side', 1000, 1000)).toBeUndefined()
    expect(framingHint(first('front'), 'front', 1000, 1000)).toBeUndefined()
  })
  it('asks the user to step in, show the whole body, or turn', () => {
    expect(framingHint(undefined, 'side', 1000, 1000)).toMatch(/Step into view/)
    expect(framingHint(first('front', 0.3), 'front', 1000, 1000)).toMatch(/whole body/)
    expect(framingHint(first('front'), 'side', 1000, 1000)).toMatch(/side-on/)
    expect(framingHint(first('side'), 'front', 1000, 1000)).toMatch(/Face the camera/)
  })
  it('asks to step back when feet are at the edge', () => {
    const lms = first('side').map((l) => ({ ...l, y: Math.min(1, l.y + 0.1) }))
    expect(framingHint(lms, 'side', 1000, 1000)).toMatch(/Step back/)
  })
})
