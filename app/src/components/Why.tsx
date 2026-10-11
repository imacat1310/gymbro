// "Why?" panel (ADR-016): the rule behind a decision, how strong the evidence is, and where it comes from.
// The registry text loads on first tap, so it stays out of the app's first download.
import { useState } from 'react'
import type { WhyCode } from '../lib/coach/why'

type Registry = typeof import('../lib/coach/why')

export function Why({ codes, label = 'Why?' }: { codes?: readonly WhyCode[]; label?: string }) {
  const [reg, setReg] = useState<Registry | null>(null)
  const [open, setOpen] = useState(false)
  const list = [...new Set(codes ?? [])]
  if (!list.length) return null

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!reg) setReg(await import('../lib/coach/why'))
    setOpen(!open)
  }

  return (
    <div className="why">
      <button type="button" className="why-toggle" aria-expanded={open} onClick={(e) => void toggle(e)}>{open ? 'Hide' : label}</button>
      {open && reg && list.filter((c) => reg.WHY[c]).map((c) => {
        const w = reg.WHY[c]
        return (
          <div key={c} className="why-panel">
            <div className="why-head"><strong>{w.title}</strong><span className={`why-ev ${w.evidence}`}>{reg.EVIDENCE_LABEL[w.evidence]}</span></div>
            <p>{w.rule}</p>
            {w.sources.length > 0 && (
              <ul className="why-sources">
                {w.sources.map((s) => <li key={s.label}>{'url' in s && s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>)}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
