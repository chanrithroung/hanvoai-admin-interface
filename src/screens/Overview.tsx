import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { api } from '../api'
import { BarChart } from '../components/BarChart'
import { Failed, Loading, PageHeader } from '../components/ui'
import { count, date } from '../format'
import { useLoad } from '../hooks'
import { href } from '../router'
import type { DayStats, Overview as OverviewData } from '../types'

const series = [
  { key: 'sessions', label: 'Sessions', unit: 'sessions' },
  { key: 'activeLearners', label: 'Active learners', unit: 'learners' },
  { key: 'newLearners', label: 'New learners', unit: 'sign-ups' },
] as const satisfies { key: keyof DayStats; label: string; unit: string }[]

function practiceTime(minutes: number) {
  if (minutes < 60) return { value: count(minutes), unit: 'min' }
  return { value: count(Math.round(minutes / 6) / 10), unit: 'hours' }
}

export function Overview() {
  const { result, reload } = useLoad(() => api.get<OverviewData>('v1/admin/overview'), [])
  const [metric, setMetric] = useState<(typeof series)[number]['key']>('sessions')

  if (result.state === 'loading') {
    return (
      <>
        <PageHeader title="Overview" />
        <Loading rows={6} />
      </>
    )
  }
  if (result.state === 'failed') {
    return (
      <>
        <PageHeader title="Overview" />
        <Failed error={result.error} onRetry={reload} />
      </>
    )
  }

  const o = result.value
  const time = practiceTime(o.practiceMinutes7d)
  const chosen = series.find((s) => s.key === metric)!
  const points = o.days.map((d) => ({ day: d.day, value: d[metric] }))
  const topPlan = Math.max(1, ...o.subscribersByPlan.map((p) => p.subscribers))

  return (
    <>
      <PageHeader
        title="Overview"
        lead={
          <>
            The last 7 days, counted by the calendar in <span className="mono">{o.timezone}</span>.
          </>
        }
      />

      <dl className="metrics">
        <div className="metric">
          <dt>Learners</dt>
          <dd>
            <span className="metric-value">{count(o.totalLearners)}</span>
            <span className="metric-note">+{count(o.newLearners7d)} this week</span>
          </dd>
        </div>
        <div className="metric">
          <dt>Active learners</dt>
          <dd>
            <span className="metric-value">{count(o.activeLearners7d)}</span>
            <span className="metric-note">practiced this week</span>
          </dd>
        </div>
        <div className="metric">
          <dt>Sessions</dt>
          <dd>
            <span className="metric-value">{count(o.sessions7d)}</span>
            <span className="metric-note">started this week</span>
          </dd>
        </div>
        <div className="metric">
          <dt>Practice time</dt>
          <dd>
            <span className="metric-value">
              {time.value}
              <small> {time.unit}</small>
            </span>
            <span className="metric-note">spoken and typed</span>
          </dd>
        </div>
        <div className="metric">
          <dt>Subscribers</dt>
          <dd>
            <span className="metric-value">{count(o.activeSubscribers)}</span>
            <span className="metric-note">on a plan right now</span>
          </dd>
        </div>
      </dl>

      <div className="overview-grid">
        <section className="panel" aria-labelledby="daily-title">
          <header className="panel-header">
            <div>
              <h2 id="daily-title">{chosen.label} per day</h2>
              <p className="muted">Last 14 days</p>
            </div>
            <div className="segmented" role="group" aria-label="Chart measure">
              {series.map((s) => (
                <button key={s.key} type="button" aria-pressed={metric === s.key} onClick={() => setMetric(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </header>
          <BarChart points={points} unit={chosen.unit} />
          <details className="chart-table">
            <summary>View as table</summary>
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="num">Sessions</th>
                  <th scope="col" className="num">Active learners</th>
                  <th scope="col" className="num">New learners</th>
                </tr>
              </thead>
              <tbody>
                {o.days.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{date(d.day)}</th>
                    <td className="num">{count(d.sessions)}</td>
                    <td className="num">{count(d.activeLearners)}</td>
                    <td className="num">{count(d.newLearners)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <div className="overview-side">
          <section className="panel" aria-labelledby="plans-title">
            <header className="panel-header">
              <h2 id="plans-title">Subscribers by plan</h2>
              <a className="text-link" href={href.plans}>
                Plans <ArrowRight size={14} aria-hidden />
              </a>
            </header>
            {o.subscribersByPlan.length === 0 ? (
              <p className="muted">No plans yet. Everyone is on the free tier.</p>
            ) : (
              <ul className="share-list">
                {o.subscribersByPlan.map((p) => (
                  <li key={p.planId}>
                    <div className="share-row">
                      <span>{p.name}</span>
                      <span className="num">{count(p.subscribers)}</span>
                    </div>
                    <span className="share-track" aria-hidden>
                      <span style={{ width: `${(p.subscribers / topPlan) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="catalog-title">
            <header className="panel-header">
              <h2 id="catalog-title">Catalog</h2>
              <a className="text-link" href={href.topics}>
                Topics <ArrowRight size={14} aria-hidden />
              </a>
            </header>
            <dl className="facts">
              <div>
                <dt>Topics in the app</dt>
                <dd className="num">
                  {count(o.activeTopics)} <span className="muted">of {count(o.topics)}</span>
                </dd>
              </div>
              <div>
                <dt>Lessons written</dt>
                <dd className="num">
                  {count(o.lessons)} <span className="muted">of {count(o.topics * 3)}</span>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  )
}
