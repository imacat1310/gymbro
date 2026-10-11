// Today's coach insight (ADR-016): the single most important signal, with its reason. Display-only; no AI.
import { Link } from 'react-router'
import { selectInsight } from '../lib/coach/signals'
import { useSignals } from '../lib/coach/useSignals'
import { Why } from './Why'

export function CoachCard() {
  const signals = useSignals()
  const insight = signals && selectInsight(signals)
  if (!insight) return null
  return (
    <section className={`card coach-card ${insight.kind}`} aria-label="Coach">
      <div className="coach-tag">Coach</div>
      <Link to={insight.href} className="coach-title">{insight.title}</Link>
      <p className="small">{insight.detail}</p>
      <Why codes={[insight.why]} />
    </section>
  )
}
