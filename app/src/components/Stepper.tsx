import { useState } from 'react'

interface Props {
  label: string
  value: number
  step: number
  min?: number
  suffix?: string
  onChange: (v: number) => void
}

/** Number field with − / + buttons. Text input so iOS shows a decimal keypad and partial input like "82." works. */
export function Stepper({ label, value, step, min = 0, suffix, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100))

  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="step-btn" aria-label={`Decrease ${label}`} onClick={() => commit(value - step)}>−</button>
        <input
          inputMode="decimal"
          value={draft ?? String(value)}
          onFocus={(e) => { setDraft(String(value)); e.target.select() }}
          onChange={(e) => setDraft(e.target.value.replace(',', '.'))}
          onBlur={() => {
            const n = parseFloat(draft ?? '')
            if (!Number.isNaN(n)) commit(n)
            setDraft(null)
          }}
          aria-label={label}
        />
        <button type="button" className="step-btn" aria-label={`Increase ${label}`} onClick={() => commit(value + step)}>+</button>
      </div>
      {suffix && <span className="stepper-suffix">{suffix}</span>}
    </div>
  )
}
