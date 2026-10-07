import { useState } from 'react'
import { useNavigate } from 'react-router'
import { EquipmentEditor } from '../components/EquipmentEditor'
import { ProfileForm } from '../components/ProfileForm'
import { GYM_PRESETS } from '../data/equipment'
import { completeOnboarding, DEFAULT_PROFILE } from '../db/repo'

export function WelcomePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [gymName, setGymName] = useState('My gym')
  const [equipment, setEquipment] = useState<string[]>(GYM_PRESETS[0].equipment)

  return (
    <div className="page">
      <header className="page-head">
        <h1>Welcome to GymBro</h1>
        <p className="muted">Step {step + 1} of 3</p>
      </header>

      {step === 0 && (
        <section className="card stack">
          <h2>Your training</h2>
          <ProfileForm profile={profile} onChange={setProfile} />
        </section>
      )}

      {step === 1 && (
        <section className="card stack">
          <h2>Your gym</h2>
          <label className="field">
            <span>Name</span>
            <input value={gymName} onChange={(e) => setGymName(e.target.value)} />
          </label>
          <p className="muted small">Pick a preset, then tap to add or remove equipment. Scanning the gym with the camera comes in a later version.</p>
          <EquipmentEditor equipment={equipment} onChange={setEquipment} />
        </section>
      )}

      {step === 2 && (
        <section className="card stack">
          <h2>Before you start</h2>
          <p>GymBro is a fitness app, <strong>not medical advice</strong>. Train within your limits.</p>
          <ul className="bullets">
            <li>Stop if you feel pain, dizziness, numbness or tingling.</li>
            <li>If you have an injury, a heart condition, are pregnant or recovering from surgery, check with a doctor or physiotherapist first.</li>
            <li>Your data stays on this phone. Nothing is uploaded.</li>
          </ul>
        </section>
      )}

      <div className="row">
        {step > 0 && <button className="secondary" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 2
          ? <button onClick={() => setStep(step + 1)} disabled={step === 1 && !gymName.trim()}>Next</button>
          : <button onClick={async () => {
              await completeOnboarding(profile, gymName.trim(), equipment)
              navigate('/', { replace: true })
            }}>I understand, let's go</button>}
      </div>
    </div>
  )
}
