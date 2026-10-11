import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PlanSetup } from '../components/PlanSetup'
import { EXERCISE_BY_ID } from '../data/exercises'
import { PlanEditor } from '../components/PlanEditor'
import type { Muscle } from '../data/exercises'
import { db, type Schedule, type Settings, type StoredPlan } from '../db/db'
import {
  acknowledgeReferrals, buildAndSavePlan, createEmptyPlan, getBodyPlanInput, setDayFocus, DEFAULT_SCHEDULE, deletePlan, duplicatePlan, getActivePlan, listPlans, nextPlanDayIndex,
  saveSettings, setActivePlan, startSession, swapPlanExercise,
} from '../db/repo'
import { FOCUS, FOCUS_ORDER, type FocusId } from '../lib/focus'
import { checkPlan, type PlanWarning } from '../lib/planEdit'
import { useActiveSession, useActiveGym, useSettings } from '../lib/hooks'
import { muscleLabel } from '../lib/planner'

const VOLUME_ORDER = ['chest', 'lats', 'upper_back', 'side_delt', 'rear_delt', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'] as const

type Mode = 'view' | 'edit' | 'rebuild' | 'new'

export function PlanPage() {
  const settings = useSettings()
  const gym = useActiveGym()
  const active = useActiveSession()
  const navigate = useNavigate()
  const plans = useLiveQuery(listPlans, [])
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null, [settings?.activePlanId])
  const planGym = useLiveQuery(async () => (plan?.gymId ? (await db.gyms.get(plan.gymId)) ?? null : null), [plan?.gymId])
  const nextDay = useLiveQuery(async () => (plan ? nextPlanDayIndex(plan) : 0), [plan?.id, plan?.days.length])
  const body = useLiveQuery(getBodyPlanInput, [])
  const [mode, setMode] = useState<Mode>('view')
  const [showPlans, setShowPlans] = useState(false)
  const [focusFor, setFocusFor] = useState<number | null>(null)

  if (!settings || plan === undefined || plans === undefined) return null
  const current = mode === 'new' || !plan ? null : plan
  const warnings = current ? checkPlan(current.days, {
    profile: settings.profile,
    limitations: settings.limitations ?? [],
    priorities: current.priorities,
    sessionMinutes: current.schedule.sessionMinutes,
    equipment: planGym?.equipment,
    gymName: planGym?.name,
    edited: !!current.edited,
  }) : []
  const planWarnings = warnings.filter((w) => w.itemIndex === undefined)

  async function start(p: StoredPlan, dayIndex: number) {
    await startSession({ plan: p, dayIndex })
    navigate('/workout')
  }

  async function rebuild(p: StoredPlan) {
    if (p.edited && !confirm('Rebuilding replaces the changes you made by hand. Continue? (Tip: duplicate the plan first to keep a copy.)')) return
    await buildAndSavePlan({ name: p.name, schedule: p.schedule, priorities: p.priorities }, p.id)
  }

  async function acknowledge() {
    if (!body?.pause) return
    if (!confirm('Include squats, deadlifts, rows and overhead presses again? Do this once a professional has checked you, or if you choose to train them anyway. Stop if anything hurts.')) return
    await acknowledgeReferrals(body.pause.sources.map((x) => x.id))
    if (current && !current.edited) await buildAndSavePlan({ name: current.name, schedule: current.schedule, priorities: current.priorities }, current.id)
  }

  const stale = !!(current && body && (current.bodyDataAt ?? 0) < body.latestAt)
  const pauseLifted = !!(current?.pausedSpinal && !body?.pause)

  async function chooseFocus(p: StoredPlan, dayIndex: number, focus: FocusId | null) {
    setFocusFor(null)
    if (p.edited && !confirm('Changing a day\'s focus rebuilds the plan and replaces your manual changes. Continue?')) return
    await setDayFocus(p.id, dayIndex, focus)
  }

  async function remove(p: StoredPlan) {
    if (confirm(`Delete "${p.name}"? Workouts you already logged are kept.`)) await deletePlan(p.id)
  }

  return (
    <div className="page">
      <header className="page-head plan-head">
        <div>
          <h1>{current?.name ?? (plans.length ? 'New plan' : 'Plan')}</h1>
          <p className="muted">{current ? `${current.splitName} · ${planGym?.name ?? gym?.name ?? ''}` : 'Built from your goal, gym, schedule and body'}</p>
        </div>
        {plans.length > 0 && mode !== 'edit' && (
          <button className="secondary" onClick={() => setShowPlans(true)}>Plans{plans.length > 1 ? ` (${plans.length})` : ''}</button>
        )}
      </header>

      {body?.pause && mode !== 'edit' && (
        <section className="card referral stack" role="alert">
          <h2>Heavy spinal loading paused</h2>
          <p className="small">
            Because {body.pause.reason}, exercises that load the lower back (squats, deadlifts, rows, overhead presses…) are left out
            of new plans and swapped for safer ones when you start a workout. A physiotherapist or doctor can tell you whether they're fine for you.
          </p>
          <div className="row">
            {body.pause.sources.map((x) => (
              <Link key={x.id} className="button secondary" to={x.kind === 'posture' ? `/profile/posture/${x.id}` : `/profile/imbalance?result=${x.id}`}>
                {x.kind === 'posture' ? 'Posture report' : 'Trunk test'}
              </Link>
            ))}
          </div>
          <button className="ghost small" onClick={() => void acknowledge()}>I've had it checked: include them again</button>
        </section>
      )}

      {current && mode === 'view' && (stale || pauseLifted) && (
        <section className="card-callout stack small">
          <span>
            {pauseLifted ? 'The safety pause is lifted. ' : `New body data since this plan was built (${body!.sources.join(', ')}). `}
            Rebuild to {pauseLifted ? 'include those exercises again' : 'update your corrective work'}.
          </span>
          <button onClick={() => void rebuild(current)}>Rebuild with my body data</button>
        </section>
      )}

      {(!current || mode === 'new') && (
        <NewPlan settings={settings} hasGym={!!gym} gymName={gym?.name} canCancel={!!plan}
          onCancel={() => setMode('view')} onCreated={() => setMode('view')} />
      )}

      {current && mode === 'rebuild' && (
        <RebuildPlan plan={current} settings={settings} hasGym={!!gym} gymName={gym?.name} onDone={() => setMode('view')} />
      )}

      {current && mode === 'edit' && (
        <PlanEditor plan={current} profile={settings.profile} equipment={planGym?.equipment ?? gym?.equipment ?? []}
          warnings={warnings} onDone={() => setMode('view')} />
      )}

      {current && planWarnings.length > 0 && mode !== 'rebuild' && (
        <section className="card stack" aria-label="Plan check">
          <h2>Plan check</h2>
          <ul className="warn-list">
            {planWarnings.map((w) => <li key={w.text} className={w.level}>{w.text}</li>)}
          </ul>
        </section>
      )}

      {current && mode === 'view' && (
        <>
          {current.gymId && gym && current.gymId !== gym.id && (
            <div className="card-callout small">
              Built for {planGym?.name ?? 'another gym'}. Exercises that aren't possible at {gym.name} are swapped automatically when you start.
            </div>
          )}
          {current.notes.length > 0 && !current.edited && (
            <section className="card stack">
              <h2>Notes</h2>
              <ul className="bullets small">{current.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </section>
          )}

          {current.days.map((day, dayIndex) => (
            <section key={dayIndex} className={`card stack ${dayIndex === nextDay ? 'next-day' : ''}`}>
              <div className="day-head">
                <div>
                  <h2>{day.name}</h2>
                  <div className="muted small">~{day.estMinutes} min · {day.items.length} exercises{dayIndex === nextDay ? ' · next up' : ''}</div>
                  <button className="focus-btn" onClick={() => setFocusFor(dayIndex)} aria-label={`Change focus of ${day.name}`}>
                    Focus: {current.dayFocus?.[dayIndex] ? FOCUS[current.dayFocus[dayIndex]!].label : 'Standard'} ▾
                  </button>
                </div>
                {!active && day.items.length > 0 && (
                  <button className={dayIndex === nextDay ? '' : 'secondary'} onClick={() => void start(current, dayIndex)}>Start</button>
                )}
              </div>
              <ol className="plan-items">
                {day.items.map((item, itemIndex) => (
                  <PlanItemRow key={`${item.exerciseId}-${itemIndex}`} plan={current} dayIndex={dayIndex} itemIndex={itemIndex}
                    warning={warnings.find((w) => w.dayIndex === dayIndex && w.itemIndex === itemIndex)} />
                ))}
              </ol>
            </section>
          ))}

          <section className="card stack">
            <h2>Weekly sets per muscle</h2>
            <p className="muted small">Hard sets per week (half credit for supporting muscles).</p>
            <dl className="volume-list">
              {VOLUME_ORDER.filter((m) => current.weeklySets[m]).map((m) => (
                <div key={m}><dt>{muscleLabel(m)}</dt><dd>{+(current.weeklySets[m] ?? 0).toFixed(1)}</dd></div>
              ))}
            </dl>
          </section>

          <section className="card stack">
            <h2>Manage plan</h2>
            <button onClick={() => setMode('edit')}>Edit exercises and days</button>
            <button className="secondary" onClick={() => setMode('rebuild')}>Change preferences and rebuild</button>
            <div className="row">
              <button className="secondary" onClick={() => void duplicatePlan(current.id)}>Duplicate</button>
              <button className="danger" onClick={() => void remove(current)}>Delete</button>
            </div>
          </section>
        </>
      )}

      {focusFor !== null && current && (
        <div className="sheet-backdrop" onClick={() => setFocusFor(null)}>
          <div className="sheet" role="dialog" aria-label="Session focus" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Session focus</h2>
              <button className="ghost" onClick={() => setFocusFor(null)}>Close</button>
            </div>
            <p className="muted small">Rebuilds {current.days[focusFor]?.name ?? 'this day'} for a sport or a quality. Other days stay as they are.</p>
            <ul className="pick-list">
              {([null, ...FOCUS_ORDER] as (FocusId | null)[]).map((f, i, all) => {
                const groupStart = f && (i === 1 || FOCUS[f].group !== (all[i - 1] ? FOCUS[all[i - 1]!].group : ''))
                const on = (current.dayFocus?.[focusFor] ?? null) === f
                return (
                  <li key={f ?? 'standard'}>
                    {groupStart && <div className="pick-group">{FOCUS[f!].group === 'sport' ? 'Sports' : 'General focus'}</div>}
                    <button className="pick-item" aria-current={on} onClick={() => void chooseFocus(current, focusFor, f)}>
                      <span>{on ? '✓ ' : ''}{f ? FOCUS[f].label : 'Standard'}</span>
                      <span className="muted small">{f ? FOCUS[f].blurb : `The plan's own ${current.splitName.toLowerCase()} day.`}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {showPlans && (
        <div className="sheet-backdrop" onClick={() => setShowPlans(false)}>
          <div className="sheet" role="dialog" aria-label="Your plans" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Your plans</h2>
              <button className="ghost" onClick={() => setShowPlans(false)}>Close</button>
            </div>
            <ul className="pick-list">
              {plans.map((p) => (
                <li key={p.id}>
                  <button className="pick-item" aria-current={p.id === plan?.id}
                    onClick={() => { void setActivePlan(p.id); setMode('view'); setShowPlans(false) }}>
                    <span>{p.id === plan?.id ? '✓ ' : ''}{p.name}</span>
                    <span className="muted small">{p.splitName} · {p.days.length} days{p.edited ? ' · edited' : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => { setMode('new'); setShowPlans(false) }}>+ New plan</button>
          </div>
        </div>
      )}
    </div>
  )
}

interface FormProps {
  settings: Settings
  hasGym: boolean
  gymName?: string
}

function GymNote({ gymName }: { gymName?: string }) {
  return (
    <p className="muted small">Goal, experience and intensity come from your <Link to="/profile">training profile</Link>. Exercises come from the equipment at <Link to="/gym">{gymName ?? 'your gym'}</Link>.</p>
  )
}

function NewPlan({ settings, hasGym, gymName, canCancel, onCancel, onCreated }: FormProps & { canCancel: boolean; onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'build' | 'empty'>('build')
  const [schedule, setSchedule] = useState<Schedule>(settings.schedule ?? DEFAULT_SCHEDULE)
  const [priorities, setPriorities] = useState<Muscle[]>(settings.priorities ?? [])
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    if (kind === 'build') await buildAndSavePlan({ name, schedule, priorities })
    else await createEmptyPlan(name)
    setBusy(false)
    onCreated()
  }

  return (
    <section className="card stack">
      <h2>{canCancel ? 'New plan' : 'Create your plan'}</h2>
      <label className="field">Name
        <input value={name} maxLength={40} placeholder={kind === 'build' ? 'e.g. Gym 4-day' : 'e.g. Home arms'} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={kind === 'build'} className={kind === 'build' ? 'active' : ''} onClick={() => setKind('build')}>Build it for me</button>
        <button role="tab" aria-selected={kind === 'empty'} className={kind === 'empty' ? 'active' : ''} onClick={() => setKind('empty')}>Start empty</button>
      </div>
      {kind === 'build' ? (
        <>
          <PlanSetup schedule={schedule} limitations={settings.limitations ?? []} priorities={priorities}
            onChange={(patch) => {
              if (patch.schedule) setSchedule(patch.schedule)
              if (patch.priorities) setPriorities(patch.priorities)
              if (patch.limitations) void saveSettings({ limitations: patch.limitations })
            }} />
          <GymNote gymName={gymName} />
        </>
      ) : (
        <p className="muted small">An empty plan with one day. Add your own exercises and days; GymBro still suggests weights and checks the plan for you.</p>
      )}
      <div className="row">
        {canCancel && <button className="secondary" onClick={onCancel}>Cancel</button>}
        <button onClick={() => void create()} disabled={busy || (kind === 'build' && !hasGym)}>{kind === 'build' ? 'Build plan' : 'Create plan'}</button>
      </div>
    </section>
  )
}

function RebuildPlan({ plan, settings, hasGym, gymName, onDone }: FormProps & { plan: StoredPlan; onDone: () => void }) {
  const [schedule, setSchedule] = useState<Schedule>(plan.schedule)
  const [priorities, setPriorities] = useState<Muscle[]>(plan.priorities)
  const [busy, setBusy] = useState(false)

  async function rebuild() {
    if (plan.edited && !confirm('Rebuilding replaces the changes you made by hand. Continue? (Tip: duplicate the plan first to keep a copy.)')) return
    setBusy(true)
    await buildAndSavePlan({ name: plan.name, schedule, priorities }, plan.id)
    setBusy(false)
    onDone()
  }

  return (
    <section className="card stack">
      <h2>Change preferences</h2>
      <PlanSetup schedule={schedule} limitations={settings.limitations ?? []} priorities={priorities}
        onChange={(patch) => {
          if (patch.schedule) setSchedule(patch.schedule)
          if (patch.priorities) setPriorities(patch.priorities)
          if (patch.limitations) void saveSettings({ limitations: patch.limitations })
        }} />
      <GymNote gymName={gymName} />
      <p className="muted small">Injuries apply to all your plans.</p>
      <div className="row">
        <button className="secondary" onClick={onDone}>Cancel</button>
        <button onClick={() => void rebuild()} disabled={busy || !hasGym}>Rebuild plan</button>
      </div>
    </section>
  )
}

function PlanItemRow({ plan, dayIndex, itemIndex, warning }: { plan: StoredPlan; dayIndex: number; itemIndex: number; warning?: PlanWarning }) {
  const [open, setOpen] = useState(false)
  const item = plan.days[dayIndex].items[itemIndex]
  const ex = EXERCISE_BY_ID.get(item.exerciseId)
  if (!ex) return null
  const unit = ex.measure === 'time' ? 's' : ''
  return (
    <li className="plan-item">
      <div className="plan-item-main">
        <div>
          <Link to={`/exercise/${ex.id}`} className="plan-item-name">{warning?.level === 'danger' && <span className="badge danger">!</span>} {ex.name}</Link>
          <div className="muted small">{item.target.sets} × {item.target.repMin}–{item.target.repMax}{unit} · {item.reason}</div>
          {warning && <div className={`small ${warning.level === 'danger' ? 'error' : 'muted'}`}>{warning.text}</div>}
        </div>
        {item.alternatives.length > 0 && (
          <button className="ghost small" aria-expanded={open} onClick={() => setOpen(!open)}>Swap</button>
        )}
      </div>
      {open && (
        <div className="chips">
          {item.alternatives.map((id) => (
            <button key={id} className="chip small" onClick={() => { void swapPlanExercise(plan.id, dayIndex, itemIndex, id); setOpen(false) }}>
              {EXERCISE_BY_ID.get(id)?.name ?? id}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
