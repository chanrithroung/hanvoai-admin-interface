import { date } from '../format'

/** The top of a four-step axis whose step is 1, 2, 2.5 or 5 × 10ⁿ, so the gridlines land on readable numbers. */
function niceMax(value: number) {
  if (value <= 4) return 4
  const raw = value / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= raw) ?? 10
  return step * magnitude * 4
}

/** A single-series daily bar chart. Each bar shows its exact value on hover or keyboard focus. */
export function BarChart({ points, unit }: { points: { day: string; value: number }[]; unit: string }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i)

  return (
    <div className="chart">
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden>
          {ticks.map((t) => (
            <div key={t} className="chart-gridline" style={{ bottom: `${(t / max) * 100}%` }}>
              <span>{t.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
        <ol className="chart-bars">
          {points.map((p, i) => (
            <li
              key={p.day}
              className="chart-column"
              tabIndex={0}
              aria-label={`${date(p.day)}: ${p.value.toLocaleString('en-US')} ${unit}`}
            >
              <span className="chart-bar" style={{ height: `${(p.value / max) * 100}%` }} data-zero={p.value === 0} />
              <span className="chart-tip" aria-hidden data-edge={i > points.length - 3 ? 'end' : i < 2 ? 'start' : undefined}>
                <strong>{p.value.toLocaleString('en-US')}</strong> {unit}
                <span>{date(p.day, true)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="chart-axis" aria-hidden>
        {points.map((p, i) => (
          <span key={p.day}>{i % 2 === points.length % 2 ? '' : date(p.day, true)}</span>
        ))}
      </div>
    </div>
  )
}
