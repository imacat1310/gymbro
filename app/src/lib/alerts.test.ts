import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beep, resetAlertsForTests, unlockAudio } from './alerts'

/** Minimal AudioContext stand-in: tracks state, resume calls and how many tones were played. */
class FakeAudioContext {
  static last: FakeAudioContext
  state: string = 'suspended'
  canResume = true
  resumeCalls = 0
  tones = 0
  currentTime = 0
  destination = {}
  constructor() { FakeAudioContext.last = this }
  async resume() {
    this.resumeCalls++
    if (this.canResume) this.state = 'running'
  }
  createOscillator() {
    this.tones++
    return { frequency: { value: 0 }, connect: (node: unknown) => node, start() {}, stop() {} }
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({}) }
  }
}

let audioSession: { type: string }

beforeEach(() => {
  resetAlertsForTests()
  audioSession = { type: 'auto' }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('navigator', { audioSession, vibrate: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())

describe('rest beep', () => {
  it('plays after the iPhone screen lock interrupted the audio (resumes first)', async () => {
    unlockAudio()
    const ctx = FakeAudioContext.last
    await Promise.resolve()
    ctx.state = 'interrupted' // what iOS Safari reports after locking or backgrounding
    await beep()
    expect(ctx.resumeCalls).toBeGreaterThanOrEqual(2)
    expect(ctx.tones).toBe(3)
  })

  it('stays quiet without throwing when audio cannot resume', async () => {
    unlockAudio()
    const ctx = FakeAudioContext.last
    await Promise.resolve()
    ctx.state = 'suspended'
    ctx.canResume = false
    await expect(beep(2)).resolves.toBeUndefined()
    expect(ctx.tones).toBe(0)
  })

  it('does nothing before the first tap unlocked audio, but still vibrates', async () => {
    await beep()
    expect(navigator.vibrate).toHaveBeenCalled()
  })

  it('uses a short-notification audio session so music is mixed, not stopped', () => {
    unlockAudio()
    expect(audioSession.type).toBe('transient')
  })
})
