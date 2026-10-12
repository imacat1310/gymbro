// Rest-end alerts. iOS only allows audio after a user gesture, so call unlockAudio() from a tap handler.
// iOS also suspends or "interrupts" the audio context when the screen locks or the app is backgrounded,
// so the context is resumed before every beep, when the app comes back, and on any tap.
let ctx: AudioContext | null = null
let listening = false

/** Short notification sound that mixes with the user's music instead of stopping it (Safari 17+ Audio Session API). */
function setAudioSession() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (!session || session.type === 'transient') return
  try {
    session.type = 'transient'
  } catch {
    // Unsupported value: keep the default.
  }
}

/** Resume a suspended or interrupted context. Resolves to whether it can play now. */
async function ensureRunning(): Promise<boolean> {
  if (!ctx) return false
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      return false
    }
  }
  return ctx.state === 'running'
}

function keepAwake() {
  if (listening || typeof document === 'undefined') return
  listening = true
  const wake = () => void ensureRunning()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake() })
  window.addEventListener('pageshow', wake)
  // Any tap is a user gesture iOS accepts for resuming audio.
  document.addEventListener('pointerdown', wake, { capture: true, passive: true })
}

export function unlockAudio() {
  try {
    setAudioSession()
    ctx ??= new AudioContext()
    void ensureRunning()
    keepAwake()
  } catch {
    ctx = null
  }
}

function playTones(c: AudioContext, times: number) {
  const now = c.currentTime
  for (let i = 0; i < times; i++) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, now + i * 0.3)
    gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.3 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.2)
    osc.connect(gain).connect(c.destination)
    osc.start(now + i * 0.3)
    osc.stop(now + i * 0.3 + 0.22)
  }
}

/** Beep (and vibrate on Android). Wakes a suspended context first instead of staying silent. */
export async function beep(times = 3): Promise<void> {
  // Android only; iOS has no Vibration API.
  navigator.vibrate?.([200, 100, 200])
  if (ctx && (await ensureRunning())) playTones(ctx, times)
}

/** For tests: forget the audio context and listeners. */
export function resetAlertsForTests() {
  ctx = null
  listening = false
}

/** Spoken guidance. Replaces anything still being said, so cues never queue up behind each other. */
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05
  speechSynthesis.speak(u)
}

/** iOS only speaks after a first utterance from a tap: call this from the tap that starts a guided flow. */
export const unlockSpeech = () => speak('')
