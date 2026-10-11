// On-device database (IndexedDB via Dexie, ADR-004 §2). All weights are stored in kg.
import Dexie, { type EntityTable } from 'dexie'
import type { Landmark } from '@mediapipe/tasks-vision'
import type { Muscle } from '../data/exercises'
import type { Area } from '../data/stress'
import type { PostureView, Tilt } from '../lib/capture'
import type { InBodyField, InBodyValues } from '../lib/inbody'
import type { TrunkResult } from '../lib/trunk'
import type { Plan } from '../lib/planner'
import type { Profile, Target } from '../lib/targets'

export interface Gym {
  id: string
  name: string
  equipment: string[]
  createdAt: number
}

export interface Schedule {
  daysPerWeek: number
  sessionMinutes: number
}

export interface Settings {
  id: 'me'
  profile: Profile
  activeGymId?: string
  onboarded: boolean
  schedule?: Schedule
  limitations?: Area[]
  priorities?: Muscle[]
  activePlanId?: string
  /** Used to convert posture-scan pixels to cm. */
  heightCm?: number
  /** Referrals the user acknowledged (posture scan / assessment id → when): lifts the safety pause (ADR-014). */
  referralAck?: Record<string, number>
}

export interface StoredPlan extends Plan {
  id: string
  /** Shown in the plan list, e.g. "Gym PPL" (ADR-007). */
  name: string
  createdAt: number
  updatedAt?: number
  gymId?: string
  /** This plan's own preferences, used when it is rebuilt. Injuries stay global (Settings.limitations). */
  schedule: Schedule
  priorities: Muscle[]
  /** Changed by hand since it was last built: turns on the volume/balance/time checks. */
  edited?: boolean
  /** Newest body data (scan, test, InBody) the plan was built with; newer data → offer a rebuild. */
  bodyDataAt?: number
  /** Built while a safety pause was active: rebuild once it's lifted. */
  pausedSpinal?: boolean
}

/** One exercise slot inside a session. */
export interface SessionEntry {
  key: string
  exerciseId: string
  target: Target
}

export interface Session {
  id: string
  gymId?: string
  startedAt: number
  endedAt?: number
  entries: SessionEntry[]
  /** Set when the workout was started from a plan day. */
  planId?: string
  dayIndex?: number
  /** Rest timer: stored as an end timestamp so it survives backgrounding (ADR-001). */
  restEndsAt?: number
  restTotalSec?: number
  feel?: number
}

export type SetKind = 'warmup' | 'working'

export interface SetLog {
  id: string
  sessionId: string
  entryKey: string
  exerciseId: string
  kind: SetKind
  weightKg: number
  /** Reps, or seconds for timed exercises. */
  reps: number
  rpe?: number
  completedAt: number
}

/** One posture photo, reduced to landmarks. The photo itself is never stored (SAFETY_PRIVACY.md, ADR-006). */
export interface ViewCapture {
  /** 33 normalized landmarks on the raw, un-mirrored camera frame: median of several frames. */
  landmarks: Landmark[]
  /** Same landmarks in metres, centred on the hips. */
  worldLandmarks: Landmark[]
  width: number
  height: number
  /** Phone tilt at capture; null when the phone gave no motion data. */
  tilt: Tilt | null
  frames: number
  /** Frame-to-frame jitter as a share of body height (lower = steadier). */
  spread: number
  /** Side view only: which side faced the camera. */
  nearSide?: 'left' | 'right'
}

export interface PostureScan {
  id: string
  takenAt: number
  heightCm?: number
  camera: 'user' | 'environment'
  views: Partial<Record<PostureView, ViewCapture>>
  appVersion: string
}

/** One body-composition measurement (InBody sheet or typed in). The sheet photo is never stored (ADR-008). */
export interface BodyComp {
  id: string
  measuredAt: number
  values: InBodyValues
  source: 'scan' | 'manual'
  /** Scan only: values read from the photo (the rest were typed or corrected by the user). */
  scanned?: InBodyField[]
  createdAt: number
}

/** An imbalance test result (ADR-010). `type` leaves room for the movement tests that follow. */
export interface Assessment {
  id: string
  type: 'trunk_rotation'
  takenAt: number
  trunk: TrunkResult
}

export const db = new Dexie('gymbro') as Dexie & {
  gyms: EntityTable<Gym, 'id'>
  settings: EntityTable<Settings, 'id'>
  sessions: EntityTable<Session, 'id'>
  sets: EntityTable<SetLog, 'id'>
  plans: EntityTable<StoredPlan, 'id'>
  postureScans: EntityTable<PostureScan, 'id'>
  bodyComps: EntityTable<BodyComp, 'id'>
  assessments: EntityTable<Assessment, 'id'>
}

db.version(1).stores({
  gyms: 'id',
  settings: 'id',
  sessions: 'id, startedAt',
  sets: 'id, sessionId, exerciseId, completedAt',
})
db.version(2).stores({ plans: 'id, createdAt' })
db.version(3).stores({ postureScans: 'id, takenAt' })
// v4: several named plans (ADR-007). Before this, every rebuild left the previous plan behind, invisible.
// Those copies are removed unless a workout was started from them; kept ones are marked "(earlier)".
db.version(4).stores({}).upgrade(async (tx) => {
  const settings = await tx.table('settings').get('me') as Settings | undefined
  const sessions = await tx.table('sessions').toArray() as Session[]
  const used = new Set(sessions.map((x) => x.planId).filter(Boolean))
  const plans = tx.table('plans')
  for (const p of await plans.toArray() as StoredPlan[]) {
    const active = p.id === settings?.activePlanId
    if (!active && !used.has(p.id)) {
      await plans.delete(p.id)
      continue
    }
    await plans.put({
      ...p,
      name: p.name ?? (active ? p.splitName : `${p.splitName} (earlier)`),
      schedule: p.schedule ?? settings?.schedule ?? { daysPerWeek: p.days.length, sessionMinutes: 60 },
      priorities: p.priorities ?? settings?.priorities ?? [],
    })
  }
})
db.version(5).stores({ bodyComps: 'id, measuredAt' })
db.version(6).stores({ assessments: 'id, type, takenAt' })

export const uid = () => crypto.randomUUID()
