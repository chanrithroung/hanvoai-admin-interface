import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { api, APIError, errorMessage } from '../api'
import { Button, Confirm, Failed, Field, Loading, Notice, Switch, useToast } from '../components/ui'
import { levelName } from '../format'
import { useLoad } from '../hooks'
import { href, navigate } from '../router'
import {
  levels,
  type ItemKind,
  type Lesson,
  type LessonItem,
  type Level,
  type ScenarioDetail,
  type ScenarioRequest,
  type ScenarioSummary,
} from '../types'

const maxItems = 40

const emptyTopic: ScenarioRequest = {
  id: '',
  level: 'BEGINNER',
  category: '',
  titleEn: '',
  titleKm: '',
  titleZh: '',
  goal: '',
  sortOrder: 100,
  active: false,
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')

export function TopicEditor({ id }: { id: string | null }) {
  const { result, reload } = useLoad<ScenarioDetail | null>(
    () => (id ? api.get<ScenarioDetail>(`v1/admin/scenarios/${encodeURIComponent(id)}`) : Promise.resolve(null)),
    [id],
  )

  return (
    <>
      <a className="back-link" href={href.topics}>
        <ArrowLeft size={16} aria-hidden /> Topics
      </a>
      {result.state === 'loading' && <Loading rows={8} />}
      {result.state === 'failed' && <Failed error={result.error} onRetry={reload} />}
      {result.state === 'loaded' && <Editor detail={result.value} />}
    </>
  )
}

function Editor({ detail }: { detail: ScenarioDetail | null }) {
  const toast = useToast()
  const isNew = detail === null
  const saved = useRef<ScenarioRequest>(detail ? toRequest(detail) : emptyTopic)
  const [topic, setTopic] = useState<ScenarioRequest>(saved.current)
  const [idEdited, setIdEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<APIError | Error | null>(null)
  const [deleting, setDeleting] = useState(false)
  const categories = useLoad(() => api.get<ScenarioSummary[]>('v1/admin/scenarios'), [])

  const dirty = JSON.stringify(topic) !== JSON.stringify(saved.current)
  const fieldError = (name: string) => (error instanceof APIError ? error.fields[name] : undefined)
  const update = (patch: Partial<ScenarioRequest>) => setTopic((t) => ({ ...t, ...patch }))

  const categoryOptions = useMemo(
    () =>
      categories.result.state === 'loaded'
        ? [...new Set(categories.result.value.map((s) => s.category))].sort()
        : [],
    [categories.result],
  )

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (isNew) {
        const created = await api.post<ScenarioDetail>('v1/admin/scenarios', topic)
        toast('Topic created')
        navigate(href.topic(created.id))
      } else {
        const updated = await api.put<ScenarioDetail>(`v1/admin/scenarios/${encodeURIComponent(detail.id)}`, topic)
        saved.current = toRequest(updated)
        setTopic(saved.current)
        toast('Topic saved')
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(errorMessage(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="topic-header">
        <div className="topic-heading">
          <p className="hanzi topic-heading-zh" lang="zh-Hans" aria-hidden={!topic.titleZh}>
            {topic.titleZh || '新话题'}
          </p>
          <div>
            <h1>{topic.titleEn || (isNew ? 'New topic' : detail.titleEn)}</h1>
            {topic.titleKm && (
              <p className="khmer muted" lang="km">
                {topic.titleKm}
              </p>
            )}
          </div>
        </div>
        {!isNew && (
          <Button variant="ghost" icon={<Trash2 size={16} aria-hidden />} onClick={() => setDeleting(true)}>
            Delete topic
          </Button>
        )}
      </header>

      <form
        className="panel"
        aria-labelledby="topic-form-title"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <header className="panel-header">
          <div>
            <h2 id="topic-form-title">Topic</h2>
            <p className="muted">What learners see in the topic list, and what the tutor aims for.</p>
          </div>
        </header>

        <div className="form-grid">
          <Field label="Chinese title" error={fieldError('titleZh')}>
            {(p) => (
              <input
                {...p}
                lang="zh-Hans"
                className="hanzi-input"
                required
                maxLength={60}
                value={topic.titleZh}
                onChange={(e) => update({ titleZh: e.target.value })}
              />
            )}
          </Field>
          <Field label="English title" error={fieldError('titleEn')}>
            {(p) => (
              <input
                {...p}
                required
                maxLength={120}
                value={topic.titleEn}
                onChange={(e) =>
                  update({ titleEn: e.target.value, ...(isNew && !idEdited ? { id: slugify(e.target.value) } : {}) })
                }
              />
            )}
          </Field>
          <Field label="Khmer title" error={fieldError('titleKm')}>
            {(p) => (
              <input
                {...p}
                lang="km"
                className="khmer"
                required
                maxLength={200}
                value={topic.titleKm}
                onChange={(e) => update({ titleKm: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Topic id"
            error={fieldError('id')}
            hint={isNew ? 'Lowercase words joined by hyphens. It can’t be changed later.' : 'Permanent.'}
          >
            {(p) => (
              <input
                {...p}
                className="mono"
                required={isNew}
                readOnly={!isNew}
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                spellCheck={false}
                value={isNew ? topic.id : detail.id}
                onChange={(e) => {
                  setIdEdited(true)
                  update({ id: e.target.value })
                }}
              />
            )}
          </Field>
          <Field label="Category" error={fieldError('category')} hint="Groups topics in the app, e.g. FOOD or TRAVEL.">
            {(p) => (
              <>
                <input
                  {...p}
                  list="categories"
                  required
                  maxLength={30}
                  value={topic.category}
                  onChange={(e) => update({ category: e.target.value.toUpperCase() })}
                />
                <datalist id="categories">
                  {categoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Listed under" hint="The level whose topic list shows it." error={fieldError('level')}>
            {(p) => (
              <select {...p} value={topic.level} onChange={(e) => update({ level: e.target.value as Level })}>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {levelName[l]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="Goal"
            className="span-2"
            error={fieldError('goal')}
            hint="What the learner should be able to do by the end. The tutor reads this."
          >
            {(p) => (
              <textarea
                {...p}
                required
                rows={3}
                maxLength={600}
                value={topic.goal}
                onChange={(e) => update({ goal: e.target.value })}
              />
            )}
          </Field>
          <Field label="Sort order" hint="Lower numbers come first." error={fieldError('sortOrder')}>
            {(p) => (
              <input
                {...p}
                type="number"
                min={0}
                max={10000}
                required
                value={topic.sortOrder}
                onChange={(e) => update({ sortOrder: e.target.valueAsNumber || 0 })}
              />
            )}
          </Field>
          <div className="field field-switch">
            <Switch checked={topic.active} onChange={(active) => update({ active })} label="Shown in the app" />
            <p className="field-hint">
              {topic.active ? 'Learners can pick this topic.' : 'Hidden from learners. Past sessions keep it.'}
            </p>
          </div>
        </div>

        {error && <Notice>{error.message}</Notice>}
        <footer className="form-footer">
          {dirty && !isNew && <span className="unsaved">Unsaved changes</span>}
          <Button type="submit" variant="primary" busy={busy} disabled={!isNew && !dirty}>
            {isNew ? 'Create topic' : 'Save topic'}
          </Button>
        </footer>
      </form>

      {isNew ? (
        <p className="muted lessons-later">Lessons can be written once the topic is created.</p>
      ) : (
        <Lessons topicId={detail.id} lessons={detail.lessons} />
      )}

      {!isNew && (
        <Confirm
          open={deleting}
          onClose={() => setDeleting(false)}
          title={`Delete “${detail.titleEn}”?`}
          body="The topic and all of its lessons are removed for good. Topics that learners have practiced can’t be deleted — hide them instead."
          action="Delete topic"
          danger
          onConfirm={async () => {
            await api.delete(`v1/admin/scenarios/${encodeURIComponent(detail.id)}`)
            toast('Topic deleted')
            navigate(href.topics)
          }}
        />
      )}
    </>
  )
}

function toRequest(d: ScenarioDetail): ScenarioRequest {
  const { lessons: _lessons, ...rest } = d
  return rest
}

// ---- Lessons

type DraftItem = LessonItem & { key: number }
type Draft = { objective: string; roleplay: string; items: DraftItem[] }

let nextKey = 1
const draftOf = (lesson?: Lesson): Draft => ({
  objective: lesson?.objective ?? '',
  roleplay: lesson?.roleplay ?? '',
  items: (lesson?.items ?? []).map((item) => ({ ...item, key: nextKey++ })),
})
const strip = (d: Draft) => ({
  objective: d.objective,
  roleplay: d.roleplay,
  items: d.items.map(({ key: _key, ...item }) => item),
})

function Lessons({ topicId, lessons }: { topicId: string; lessons: Lesson[] }) {
  const toast = useToast()
  const initial = Object.fromEntries(levels.map((l) => [l, lessons.find((x) => x.level === l)])) as Record<
    Level,
    Lesson | undefined
  >
  const [saved, setSaved] = useState(initial)
  const [drafts, setDrafts] = useState(
    () => Object.fromEntries(levels.map((l) => [l, draftOf(initial[l])])) as Record<Level, Draft>,
  )
  const [level, setLevel] = useState<Level>(levels.find((l) => !initial[l]) ?? 'BEGINNER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<APIError | Error | null>(null)
  const [deleting, setDeleting] = useState(false)

  const draft = drafts[level]
  const isDirty = (l: Level) => JSON.stringify(strip(drafts[l])) !== JSON.stringify(strip(draftOf(saved[l])))
  const setDraft = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [level]: { ...all[level], ...patch } }))
  const setItem = (key: number, patch: Partial<LessonItem>) =>
    setDraft({ items: draft.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) })
  const move = (index: number, by: number) => {
    const items = [...draft.items]
    const [it] = items.splice(index, 1)
    items.splice(index + by, 0, it)
    setDraft({ items })
  }
  const add = (kind: ItemKind) =>
    setDraft({ items: [...draft.items, { kind, hanzi: '', pinyin: '', en: '', km: '', key: nextKey++ }] })
  const fieldError = (name: string) => (error instanceof APIError ? error.fields[name] : undefined)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const lesson = await api.put<Lesson>(
        `v1/admin/scenarios/${encodeURIComponent(topicId)}/lessons/${level}`,
        strip(draft),
      )
      setSaved((s) => ({ ...s, [level]: lesson }))
      setDrafts((all) => ({ ...all, [level]: draftOf(lesson) }))
      toast(`${levelName[level]} lesson saved`)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(errorMessage(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel lessons" aria-labelledby="lessons-title">
      <header className="panel-header">
        <div>
          <h2 id="lessons-title">Lessons</h2>
          <p className="muted">The words and patterns the tutor teaches in order, then a role-play that uses them.</p>
        </div>
      </header>

      <div className="level-tabs" role="tablist" aria-label="Level">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            id={`tab-${l}`}
            aria-selected={level === l}
            aria-controls="lesson-panel"
            onClick={() => {
              setLevel(l)
              setError(null)
            }}
          >
            <span>{levelName[l]}</span>
            <span className="level-state" data-written={saved[l] !== undefined}>
              {isDirty(l) ? 'Unsaved' : saved[l] ? `${saved[l]!.items.length} items` : 'Not written'}
            </span>
          </button>
        ))}
      </div>

      <form
        id="lesson-panel"
        role="tabpanel"
        aria-labelledby={`tab-${level}`}
        className="lesson-body"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="lesson-edit">
          <Field
            label="Objective"
            error={fieldError('objective')}
            hint="One or two sentences on what this level practices."
          >
            {(p) => (
              <textarea
                {...p}
                required
                rows={2}
                maxLength={600}
                value={draft.objective}
                onChange={(e) => setDraft({ objective: e.target.value })}
              />
            )}
          </Field>

          <div className="items" role="group" aria-labelledby="items-title">
            <div className="items-header">
              <h3 id="items-title">Items</h3>
              <span className="muted">
                {draft.items.length} of {maxItems}
              </span>
            </div>
            {draft.items.length === 0 && (
              <p className="items-empty">Add the words and sentence patterns this lesson teaches, in teaching order.</p>
            )}
            <ol className="item-list">
              {draft.items.map((item, i) => (
                <li key={item.key} className="item-row">
                  <span className="item-index num" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="item-fields">
                    <label className="item-kind">
                      <span className="visually-hidden">Item {i + 1} kind</span>
                      <select value={item.kind} onChange={(e) => setItem(item.key, { kind: e.target.value as ItemKind })}>
                        <option value="WORD">Word</option>
                        <option value="PATTERN">Pattern</option>
                      </select>
                    </label>
                    <ItemInput label="Hanzi" index={i} lang="zh-Hans" className="hanzi-input" max={60}
                      value={item.hanzi} error={fieldError(`items[${i}].hanzi`)}
                      onChange={(hanzi) => setItem(item.key, { hanzi })} />
                    <ItemInput label="Pinyin" index={i} max={150}
                      value={item.pinyin} error={fieldError(`items[${i}].pinyin`)}
                      onChange={(pinyin) => setItem(item.key, { pinyin })} />
                    <ItemInput label="English" index={i} max={200}
                      value={item.en} error={fieldError(`items[${i}].en`)}
                      onChange={(en) => setItem(item.key, { en })} />
                    <ItemInput label="Khmer" index={i} lang="km" className="khmer" max={200}
                      value={item.km} error={fieldError(`items[${i}].km`)}
                      onChange={(km) => setItem(item.key, { km })} />
                  </div>
                  <div className="item-actions">
                    <button type="button" className="icon-button" disabled={i === 0} onClick={() => move(i, -1)}
                      aria-label={`Move item ${i + 1} up`}>
                      <ArrowUp size={16} aria-hidden />
                    </button>
                    <button type="button" className="icon-button" disabled={i === draft.items.length - 1}
                      onClick={() => move(i, 1)} aria-label={`Move item ${i + 1} down`}>
                      <ArrowDown size={16} aria-hidden />
                    </button>
                    <button type="button" className="icon-button" aria-label={`Remove item ${i + 1}`}
                      onClick={() => setDraft({ items: draft.items.filter((it) => it.key !== item.key) })}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="action-row">
              <Button icon={<Plus size={16} aria-hidden />} disabled={draft.items.length >= maxItems} onClick={() => add('WORD')}>
                Add word
              </Button>
              <Button icon={<Plus size={16} aria-hidden />} disabled={draft.items.length >= maxItems} onClick={() => add('PATTERN')}>
                Add pattern
              </Button>
            </div>
          </div>

          <Field
            label="Role-play"
            error={fieldError('roleplay')}
            hint="The closing scene: who the tutor plays and what the learner has to do, using the items above."
          >
            {(p) => (
              <textarea
                {...p}
                required
                rows={4}
                maxLength={1000}
                value={draft.roleplay}
                onChange={(e) => setDraft({ roleplay: e.target.value })}
              />
            )}
          </Field>

          {error && <Notice>{error.message}</Notice>}
          <footer className="form-footer">
            {saved[level] && (
              <Button variant="ghost" icon={<Trash2 size={16} aria-hidden />} onClick={() => setDeleting(true)}>
                Delete lesson
              </Button>
            )}
            <span className="form-footer-gap" />
            {isDirty(level) && saved[level] && (
              <Button variant="ghost" onClick={() => setDrafts((all) => ({ ...all, [level]: draftOf(saved[level]) }))}>
                Discard changes
              </Button>
            )}
            <Button type="submit" variant="primary" busy={busy} disabled={!isDirty(level) || draft.items.length === 0}>
              Save {levelName[level].toLowerCase()} lesson
            </Button>
          </footer>
        </div>

        <aside className="lesson-preview" aria-label="Preview">
          <p className="eyebrow">As the learner meets them</p>
          {draft.items.length === 0 ? (
            <p className="muted">Items appear here as you write them.</p>
          ) : (
            <ol className="preview-list">
              {draft.items.map((item) => (
                <li key={item.key} className="preview-card" data-kind={item.kind}>
                  <span className="preview-kind">{item.kind === 'WORD' ? 'Word' : 'Pattern'}</span>
                  <span className="preview-pinyin">{item.pinyin || '—'}</span>
                  <span className="hanzi preview-hanzi" lang="zh-Hans">
                    {item.hanzi || '…'}
                  </span>
                  <span className="preview-meaning">{item.en}</span>
                  <span className="khmer preview-meaning muted" lang="km">
                    {item.km}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </form>

      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete the ${levelName[level].toLowerCase()} lesson?`}
        body="Learners at this level can still pick the topic, but the tutor works from its goal alone, without a set list of words, until a new lesson is written."
        action="Delete lesson"
        danger
        onConfirm={async () => {
          await api.delete(`v1/admin/scenarios/${encodeURIComponent(topicId)}/lessons/${level}`)
          setSaved((s) => ({ ...s, [level]: undefined }))
          setDrafts((all) => ({ ...all, [level]: draftOf() }))
          toast(`${levelName[level]} lesson deleted`)
        }}
      />
    </section>
  )
}

function ItemInput({
  label,
  index,
  value,
  onChange,
  error,
  max,
  lang,
  className,
}: {
  label: string
  index: number
  value: string
  onChange: (value: string) => void
  error?: string
  max: number
  lang?: string
  className?: string
}) {
  return (
    <label className="item-field">
      <span className="item-label">{label}</span>
      <input
        lang={lang}
        className={className}
        required
        maxLength={max}
        value={value}
        aria-label={`Item ${index + 1} ${label}`}
        aria-invalid={error ? true : undefined}
        title={error}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
