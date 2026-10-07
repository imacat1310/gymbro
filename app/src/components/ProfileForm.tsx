import {
  EXPERIENCE_LABELS, GOAL_LABELS, INTENSITY_LABELS, type Experience, type Goal, type Intensity, type Profile,
} from '../lib/targets'

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="chips">
        {(Object.keys(options) as T[]).map((k) => (
          <button key={k} type="button" className={`chip ${value === k ? 'on' : ''}`} aria-pressed={value === k} onClick={() => onChange(k)}>
            {options[k]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function ProfileForm({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  return (
    <div className="stack">
      <Choice<Goal> label="Goal" value={profile.goal} options={GOAL_LABELS} onChange={(goal) => onChange({ ...profile, goal })} />
      <Choice<Experience> label="Experience" value={profile.experience} options={EXPERIENCE_LABELS} onChange={(experience) => onChange({ ...profile, experience })} />
      <Choice<Intensity> label="Preferred intensity" value={profile.intensity} options={INTENSITY_LABELS} onChange={(intensity) => onChange({ ...profile, intensity })} />
      {profile.experience === 'beginner' && profile.intensity !== 'easy' && (
        <p className="muted small">Beginners are capped at RPE 8 for safety, whatever the intensity. You'll still progress quickly.</p>
      )}
    </div>
  )
}
