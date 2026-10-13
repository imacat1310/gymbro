// Runs the evaluation over a folder of samples: FORM_EVAL_DATA=/path npm run form-eval
// Data stays outside the repository (labelled body points of real people). Writes form-eval-report.md there.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'vitest'
import { isSample, makeSample, type FormSample } from '../../src/lib/form/sample'
import { EMPTY_PROFILE, type FaultCode, type Recording } from '../../src/lib/form/types'
import { FAULT_TITLE } from '../../src/lib/form/views'
import { evaluate, MIN_SUPPORT, sweep } from './metrics'

/**
 * labels.csv (optional, for converted dataset videos): `file,rep,faults`
 * - rep = a rep number → faults on that rep (";"-separated, empty = good rep)
 * - rep = clip → faults anywhere in the clip
 * - rep = count → `faults` holds the true number of reps
 */
function applyCsv(samples: Map<string, FormSample>, csv: string) {
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const [file, rep, faults = ''] = line.split(',').map((x) => x.trim())
    const s = samples.get(file)
    if (!s) { console.warn(`labels.csv: no sample named ${file}`); continue }
    const labels = (s.labels ??= {})
    const list = faults.split(';').map((x) => x.trim()).filter(Boolean) as FaultCode[]
    if (rep === 'clip') labels.clip = list
    else if (rep === 'count') labels.reps = Number(faults)
    else (labels.perRep ??= {})[Number(rep)] = list
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

it('form-check evaluation', () => {
  const dir = process.env.FORM_EVAL_DATA
  if (!dir || !existsSync(dir)) throw new Error('Set FORM_EVAL_DATA to a folder of samples (.json)')
  const samples = new Map<string, FormSample>()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    if (isSample(json)) samples.set(f, json)
    else if (json?.frames) samples.set(f, makeSample(json as Recording, EMPTY_PROFILE, null, undefined, 'raw'))
  }
  if (existsSync(join(dir, 'labels.csv'))) applyCsv(samples, readFileSync(join(dir, 'labels.csv'), 'utf8'))

  const list = [...samples.values()]
  const e = evaluate(list)
  const s = sweep(list)
  const lines = [
    `# Form-check evaluation`, '',
    `${e.samples} samples · ${e.labelled} labelled · ${e.unusable} unusable (not visible / no reps)`, '',
    `**Rep count:** ${e.repCount.exact}/${e.repCount.samples} exact, mean error ${e.repCount.meanAbsError.toFixed(2)} reps`, '',
    '| Fault | Labelled (fault / ok) | Caught | Missed | False alarms | Precision | Recall | F1 |', '|---|---|---|---|---|---|---|---|',
    // n/a where a score can't be computed (no warnings fired / no labelled faults), so "no data" doesn't read as 0%.
    ...Object.entries(e.faults).map(([f, x]) => `| ${FAULT_TITLE[f as FaultCode]} | ${x!.positives} / ${x!.negatives} | ${x!.tp} | ${x!.fn} | ${x!.fp} | ${
      x!.tp + x!.fp ? pct(x!.precision) : 'n/a'} | ${x!.positives ? pct(x!.recall) : 'n/a'} | ${x!.positives ? x!.f1.toFixed(2) : 'n/a'} |`),
    '', '## Threshold sweep', '',
    '| Fault | Threshold | Current (F1) | Best (F1) | Suggest? |', '|---|---|---|---|---|',
    ...s.map((r) => `| ${FAULT_TITLE[r.fault]} | ${r.label} | ${r.current} (${r.currentF1.toFixed(2)}) | ${r.best} (${r.bestF1.toFixed(2)}) | ${
      !r.enoughData ? `not enough data (need ${MIN_SUPPORT}+ each way)` : r.best === r.current ? 'keep' : `**change to ${r.best}**`} |`),
    '', 'Ship a threshold change only with enough data, recorded in ADR-022. The spec target is F1 ≈ 0.8 before a fault leaves beta.',
  ]
  const report = lines.join('\n')
  writeFileSync(join(dir, 'form-eval-report.md'), report + '\n')
  console.log(report)
})
