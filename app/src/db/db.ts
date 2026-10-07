// On-device database (IndexedDB via Dexie, ADR-004 §2). All weights are stored in kg.
import Dexie, { type EntityTable } from 'dexie'
import type { Muscle } from '../data/exercises'
import type { Area } from '../data/stress'
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
}

export interface StoredPlan extends Plan {
  id: string
  createdAt: number
  gymId?: string
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

export const db = new Dexie('gymbro') as Dexie & {
  gyms: EntityTable<Gym, 'id'>
  settings: EntityTable<Settings, 'id'>
  sessions: EntityTable<Session, 'id'>
  sets: EntityTable<SetLog, 'id'>
  plans: EntityTable<StoredPlan, 'id'>
}

db.version(1).stores({
  gyms: 'id',
  settings: 'id',
  sessions: 'id, startedAt',
  sets: 'id, sessionId, exerciseId, completedAt',
})
db.version(2).stores({ plans: 'id, createdAt' })

export const uid = () => crypto.randomUUID()
