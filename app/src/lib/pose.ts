// MediaPipe Pose Landmarker wrapper. The library is loaded on demand so it stays out of the main bundle.
import type { DrawingUtils, NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision'

export type PoseModel = 'lite' | 'full'
export type Delegate = 'GPU' | 'CPU'
/** VIDEO for live camera frames (Lite), IMAGE for still captures (Full). */
export type RunningMode = 'VIDEO' | 'IMAGE'

export interface PoseEngine {
  landmarker: PoseLandmarker
  delegate: Delegate
  /** Time to load the runtime + model, in ms. */
  loadMs: number
  createDrawer: (ctx: CanvasRenderingContext2D) => DrawingUtils
  connections: typeof PoseLandmarker.POSE_CONNECTIONS
}

// BlazePose landmark indices (0–10 are the face).
export const LM = {
  nose: 0,
  leftEar: 7, rightEar: 8,
  leftShoulder: 11, rightShoulder: 12,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
  leftHeel: 29, rightHeel: 30,
  leftFootIndex: 31, rightFootIndex: 32,
} as const

export async function createPoseEngine(model: PoseModel, delegate: Delegate, runningMode: RunningMode = 'VIDEO'): Promise<PoseEngine> {
  const t0 = performance.now()
  const vision = await import('@mediapipe/tasks-vision')
  const base = import.meta.env.BASE_URL
  const fileset = await vision.FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`)
  const create = (d: Delegate) => vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${base}models/pose_landmarker_${model}.task`, delegate: d },
    runningMode,
    numPoses: 1,
  })

  let landmarker: PoseLandmarker
  let used = delegate
  try {
    landmarker = await create(delegate)
  } catch (err) {
    if (delegate === 'CPU') throw err
    console.warn('GPU delegate failed, falling back to CPU', err)
    landmarker = await create('CPU')
    used = 'CPU'
  }

  return {
    landmarker,
    delegate: used,
    loadMs: Math.round(performance.now() - t0),
    createDrawer: (ctx) => new vision.DrawingUtils(ctx),
    connections: vision.PoseLandmarker.POSE_CONNECTIONS,
  }
}

/** Angle at b (degrees) formed by a-b-c, in pixel space so the aspect ratio doesn't skew it. */
export function angleDeg(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark, width: number, height: number): number {
  const abx = (a.x - b.x) * width, aby = (a.y - b.y) * height
  const cbx = (c.x - b.x) * width, cby = (c.y - b.y) * height
  const cos = (abx * cbx + aby * cby) / (Math.hypot(abx, aby) * Math.hypot(cbx, cby))
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}
