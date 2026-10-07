import { useState } from 'react'

export interface Point { x: number; y: number }

interface Props {
  points: Point[]
  /** Accessible name; the visible title is rendered by the caller. */
  label: string
  formatX: (x: number) => string
  formatY: (y: number) => string
}

const W = 340
const H = 180
const PAD = { top: 12, right: 12, bottom: 24, left: 40 }

function niceTicks(min: number, max: number, count = 3) {
  const span = max - min || 1
  const step = Math.pow(10, Math.floor(Math.log10(span / count)))
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= count) ?? step * 10
  const start = Math.floor(min / nice) * nice
  const ticks = []
  for (let v = start; v <= max + nice * 0.001; v += nice) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** Single-series line chart: 2px line, 8px markers, recessive grid, tap/hover crosshair with tooltip. */
export function LineChart({ points, label, formatX, formatY }: Props) {
  const [active, setActive] = useState<number | null>(null)
  if (points.length < 2) return null

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
  const yMin = ticks[0]
  const yMax = Math.max(ticks[ticks.length - 1], Math.max(...ys))
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right)
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')

  function nearest(clientX: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * W
    let best = 0
    points.forEach((p, i) => { if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x)) best = i })
    setActive(best)
  }

  const a = active !== null ? points[active] : null
  const tipLeft = a ? Math.min(Math.max(sx(a.x) / W * 100, 18), 82) : 0

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={sy(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">{formatY(t)}</text>
          </g>
        ))}
        <text x={sx(xMin)} y={H - 6} className="chart-axis" textAnchor="start">{formatX(xMin)}</text>
        <text x={sx(xMax)} y={H - 6} className="chart-axis" textAnchor="end">{formatX(xMax)}</text>
        {a && <line x1={sx(a.x)} x2={sx(a.x)} y1={PAD.top} y2={H - PAD.bottom} className="chart-crosshair" />}
        <path d={path} className="chart-line" />
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={i === active ? 5 : 4} className="chart-dot" />
        ))}
      </svg>
      {a && (
        <div className="chart-tip" style={{ left: `${tipLeft}%` }}>
          <div className="muted small">{formatX(a.x)}</div>
          <strong>{formatY(a.y)}</strong>
        </div>
      )}
    </div>
  )
}
