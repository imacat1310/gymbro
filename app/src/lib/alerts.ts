// Rest-end alerts. iOS only allows audio after a user gesture, so call unlockAudio() from a tap handler.
let ctx: AudioContext | null = null

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(times = 3) {
  if (ctx && ctx.state === 'running') {
    const now = ctx.currentTime
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, now + i * 0.3)
      gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.3 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.3)
      osc.stop(now + i * 0.3 + 0.22)
    }
  }
  // Android only; iOS has no Vibration API.
  navigator.vibrate?.([200, 100, 200])
}
