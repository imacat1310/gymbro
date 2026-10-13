// Analyse a video from the camera roll (ADR-022): step through it at the live-recording frame rate, so the same
// rules and thresholds apply. The video never leaves the phone and isn't stored; only body points are produced.
import { createPoseEngine } from '../pose'
import type { FormView, PoseFrame, Recording } from './types'

export const VIDEO_FPS = 30
export const MAX_VIDEO_SEC = 90

/** Timestamps (seconds) to sample: every 1/fps up to the duration, capped. */
export function sampleTimes(durationSec: number, fps = VIDEO_FPS, maxSec = MAX_VIDEO_SEC): number[] {
  const end = Math.min(durationSec, maxSec)
  const n = Math.max(0, Math.floor(end * fps))
  return Array.from({ length: n }, (_, i) => i / fps)
}

export interface VideoProgress { done: number; total: number }

/**
 * Decode `file` frame by frame and detect the pose in each. Resolves with a Recording, or rejects when the
 * video can't be read. `signal` cancels.
 */
export async function recordingFromVideo(file: File, exerciseId: string, view: FormView,
  onProgress: (p: VideoProgress) => void, signal?: AbortSignal): Promise<Recording & { truncated: boolean }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  // Some browsers only decode frames for videos in the document; keep it in, but invisible.
  video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(video)
  const engine = await createPoseEngine('lite', 'GPU', 'VIDEO')
  try {
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("This video can't be read on this phone."))
    })
    const times = sampleTimes(video.duration)
    const frames: PoseFrame[] = []
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      await seek(video, times[i])
      const t = Math.round(times[i] * 1000)
      const lms = engine.landmarker.detectForVideo(video, t + 1).landmarks[0]
      if (lms) frames.push({ t, lms: lms.map((l) => ({ ...l })) })
      if (i % 10 === 0 || i === times.length - 1) onProgress({ done: i + 1, total: times.length })
    }
    return { exerciseId, view, width: video.videoWidth, height: video.videoHeight, frames, truncated: video.duration > MAX_VIDEO_SEC }
  } finally {
    engine.landmarker.close()
    video.remove()
    URL.revokeObjectURL(url)
  }
}

/** Seek and wait for the frame; gives up after 3 s so a stuck decoder can't hang the analysis. */
function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); video.removeEventListener('seeked', done); resolve() }
    const timer = setTimeout(done, 3000)
    video.addEventListener('seeked', done)
    video.currentTime = time
  })
}
