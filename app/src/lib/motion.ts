// Motion sensor access shared by the posture scan (level check) and the trunk rotation test.

/** iOS asks for motion-sensor access, and only from a tap. Other platforms have no prompt. Never throws. */
export async function requestMotionPermission(): Promise<boolean> {
  const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  if (!DM) return false
  try {
    return (await DM.requestPermission?.()) !== 'denied'
  } catch {
    return false
  }
}

export interface GravityReading { x: number; y: number; z: number; t: number }

/** Subscribe to the gravity vector (accelerometer incl. gravity). Returns an unsubscribe function. */
export function onGravity(cb: (g: GravityReading) => void): () => void {
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (a?.x == null || a.y == null || a.z == null) return
    cb({ x: a.x, y: a.y, z: a.z, t: performance.now() })
  }
  window.addEventListener('devicemotion', handler)
  return () => window.removeEventListener('devicemotion', handler)
}
