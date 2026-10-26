import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../api'
import { Button, Empty, Failed, Loading, PageHeader } from '../components/ui'
import { count, levelName } from '../format'
import { useLoad } from '../hooks'
import { href, navigate } from '../router'
import { levels, type Level, type ScenarioSummary } from '../types'

type Filter = 'all' | Level | 'hidden'

/** One mark per level: filled when that level's lesson is written. */
export function LessonMarks({ written }: { written: Level[] }) {
  const missing = levels.filter((l) => !written.includes(l))
  return (
    <span
      className="lesson-marks"
      role="img"
      aria-label={
        missing.length === 0 ? 'Lessons for every level' : `No lesson for ${missing.map((l) => levelName[l]).join(', ')}`
      }
    >
      {levels.map((l) => (
        <span key={l} data-written={written.includes(l)} title={`${levelName[l]}: ${written.includes(l) ? 'written' : 'missing'}`}>
          {levelName[l][0]}
        </span>
      ))}
    </span>
  )
}

export function Topics() {
  const { result, reload } = useLoad(() => api.get<ScenarioSummary[]>('v1/admin/scenarios'), [])
  const [filter, setFilter] = useState<Filter>('all')

  const all = result.state === 'loaded' ? result.value : []
  const shown = all.filter((s) =>
    filter === 'all' ? true : filter === 'hidden' ? !s.active : s.level === filter,
  )
  const incomplete = all.filter((s) => s.active && s.lessonLevels.length < levels.length).length

  return (
    <>
      <PageHeader
        title="Topics & lessons"
        lead="Each topic has one lesson per level. The tutor teaches the lesson that matches the learner’s level."
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => navigate(href.newTopic)}>
            New topic
          </Button>
        }
      />

      {result.state === 'loading' && <Loading rows={8} />}
      {result.state === 'failed' && <Failed error={result.error} onRetry={reload} />}
      {result.state === 'loaded' && (
        <>
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Show topics">
              {(['all', ...levels, 'hidden'] as Filter[]).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'hidden' ? 'Hidden' : levelName[f]}
                </button>
              ))}
            </div>
            {incomplete > 0 && (
              <p className="muted toolbar-count">
                {count(incomplete)} {incomplete === 1 ? 'topic in the app is' : 'topics in the app are'} missing a lesson
              </p>
            )}
          </div>

          {shown.length === 0 ? (
            <Empty title={all.length === 0 ? 'No topics yet' : 'No topics here'}>
              {all.length === 0 && (
                <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => navigate(href.newTopic)}>
                  New topic
                </Button>
              )}
            </Empty>
          ) : (
            <ul className="topic-list">
              {shown.map((s) => (
                <li key={s.id}>
                  <a className="topic-row" href={href.topic(s.id)} data-hidden={!s.active}>
                    <span className="hanzi topic-zh" lang="zh-Hans">
                      {s.titleZh}
                    </span>
                    <span className="topic-titles">
                      <span className="cell-title">{s.titleEn}</span>
                      <span className="khmer cell-sub" lang="km">
                        {s.titleKm}
                      </span>
                    </span>
                    <span className="topic-meta">
                      <span className="mono">{s.id}</span>
                      <span>
                        {s.category} · {levelName[s.level]}
                      </span>
                    </span>
                    <LessonMarks written={s.lessonLevels} />
                    <span className="topic-sessions num">
                      {count(s.sessions)} <span className="muted">sessions</span>
                    </span>
                    {!s.active && <span className="status status-off">Hidden</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
