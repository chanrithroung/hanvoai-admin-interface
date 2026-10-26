import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { api, errorMessage } from '../api'
import { Button, Confirm, Dialog, Empty, Failed, Field, Loading, Notice, PageHeader, useToast } from '../components/ui'
import { count, date, lastActive, levelName } from '../format'
import { useDebounced, useLoad } from '../hooks'
import type { AdminPlan, AdminUser, PlansResponse, UserPage } from '../types'

const pageSize = 25

const methodName: Record<string, string> = {
  password: 'Email',
  google: 'Google',
  apple: 'Apple',
  telegram: 'Telegram',
  phone: 'Phone',
}

const nameOf = (u: AdminUser) => u.displayName || u.email || u.phone || 'Unnamed learner'

export function Learners() {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => setPage(0), [q])

  const { result, reload, set } = useLoad(() => {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    if (q) params.set('q', q)
    return api.get<UserPage>(`v1/admin/users?${params}`)
  }, [q, page])

  const open = result.state === 'loaded' ? result.value.items.find((u) => u.id === openId) : undefined
  const replace = (user: AdminUser) => {
    if (result.state !== 'loaded') return
    set({ ...result.value, items: result.value.items.map((u) => (u.id === user.id ? user : u)) })
  }

  return (
    <>
      <PageHeader title="Learners" lead="Everyone with a HANVO account, newest first." />

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden />
          <span className="visually-hidden">Search learners</span>
          <input
            type="search"
            placeholder="Search by name, email or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {result.state === 'loaded' && (
          <p className="muted toolbar-count" aria-live="polite">
            {count(result.value.total)} {result.value.total === 1 ? 'learner' : 'learners'}
          </p>
        )}
      </div>

      {result.state === 'loading' && <Loading rows={8} />}
      {result.state === 'failed' && <Failed error={result.error} onRetry={reload} />}
      {result.state === 'loaded' &&
        (result.value.items.length === 0 ? (
          <Empty title={q ? `No learners match “${q}”` : 'No learners yet'}>
            <p className="muted">
              {q ? 'Check the spelling, or search by part of an email address.' : 'Accounts appear here once people sign up.'}
            </p>
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    <th scope="col">Signs in with</th>
                    <th scope="col">Level</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Last active</th>
                    <th scope="col" className="num">Sessions</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.value.items.map((u) => (
                    <tr key={u.id} className="row-link" onClick={() => setOpenId(u.id)}>
                      <th scope="row">
                        <button type="button" className="cell-button" onClick={() => setOpenId(u.id)}>
                          <span className="cell-title">
                            {nameOf(u)}
                            {u.role === 'ADMIN' && <span className="tag">Admin</span>}
                          </span>
                          <span className="cell-sub">{u.email ?? u.phone ?? 'No email'}</span>
                        </button>
                      </th>
                      <td>{u.signInMethods.map((m) => methodName[m] ?? m).join(', ')}</td>
                      <td>{u.level ? levelName[u.level] : <span className="muted">Not set</span>}</td>
                      <td>{u.subscription ? u.subscription.planName : <span className="muted">Free</span>}</td>
                      <td>{lastActive(u.lastActiveDay)}</td>
                      <td className="num">{count(u.sessions)}</td>
                      <td>
                        <StatusTag user={u} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={result.value.total} onPage={setPage} />
          </>
        ))}

      <Dialog
        open={open !== undefined}
        onClose={() => setOpenId(null)}
        side
        title={open ? nameOf(open) : ''}
        description={open?.email ?? open?.phone}
      >
        {open && <LearnerPanel user={open} onChange={replace} />}
      </Dialog>
    </>
  )
}

function StatusTag({ user }: { user: AdminUser }) {
  return user.status === 'ACTIVE' ? (
    <span className="status status-ok">Active</span>
  ) : (
    <span className="status status-alert">Suspended</span>
  )
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages === 1) return null
  const first = page * pageSize + 1
  const last = Math.min(total, first + pageSize - 1)
  return (
    <nav className="pagination" aria-label="Pages">
      <span className="muted">
        {count(first)}–{count(last)} of {count(total)}
      </span>
      <Button icon={<ChevronLeft size={16} aria-hidden />} disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        Next <ChevronRight size={16} aria-hidden />
      </Button>
    </nav>
  )
}

type Pending = 'suspend' | 'restore' | 'cancelPlan' | null

function LearnerPanel({ user, onChange }: { user: AdminUser; onChange: (user: AdminUser) => void }) {
  const toast = useToast()
  const [pending, setPending] = useState<Pending>(null)
  const plans = useLoad(() => api.get<PlansResponse>('v1/admin/plans'), [])
  const name = nameOf(user)

  const patch = async (body: Partial<Pick<AdminUser, 'status' | 'role'>>, done: string) => {
    onChange(await api.patch<AdminUser>(`v1/admin/users/${user.id}`, body))
    toast(done)
  }

  const confirms: Record<Exclude<Pending, null>, { title: string; body: string; action: string; danger?: boolean; run: () => Promise<void> }> = {
    suspend: {
      title: `Suspend ${name}?`,
      body: 'They are signed out on every device and can’t sign in until you restore the account. Their history is kept.',
      action: 'Suspend account',
      danger: true,
      run: () => patch({ status: 'SUSPENDED' }, 'Account suspended'),
    },
    restore: {
      title: `Restore ${name}?`,
      body: 'They can sign in and practice again.',
      action: 'Restore account',
      run: () => patch({ status: 'ACTIVE' }, 'Account restored'),
    },
    cancelPlan: {
      title: `Move ${name} to the free tier?`,
      body: `Their ${user.subscription?.planName ?? ''} subscription ends now and the free tier’s daily limits apply from their next request.`,
      action: 'Move to free tier',
      danger: true,
      run: async () => {
        await api.delete(`v1/admin/users/${user.id}/subscription`)
        onChange({ ...user, subscription: undefined })
        toast('Moved to the free tier')
      },
    },
  }
  const confirm = pending ? confirms[pending] : null

  return (
    <div className="stack">
      <dl className="facts">
        <div>
          <dt>Joined</dt>
          <dd>{date(user.createdAt)}</dd>
        </div>
        <div>
          <dt>Last active</dt>
          <dd>{lastActive(user.lastActiveDay)}</dd>
        </div>
        <div>
          <dt>Sessions</dt>
          <dd className="num">{count(user.sessions)}</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd>{user.level ? levelName[user.level] : 'Not set'}</dd>
        </div>
        <div>
          <dt>Signs in with</dt>
          <dd>{user.signInMethods.map((m) => methodName[m] ?? m).join(', ') || 'None'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusTag user={user} />
          </dd>
        </div>
      </dl>

      <section className="panel-section" aria-labelledby="plan-title">
        <h3 id="plan-title">Plan</h3>
        {user.subscription ? (
          <div className="plan-current">
            <div>
              <p className="cell-title">{user.subscription.planName}</p>
              <p className="cell-sub">
                Since {date(user.subscription.startsAt)} ·{' '}
                {user.subscription.endsAt ? `ends ${date(user.subscription.endsAt)}` : 'no end date'}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setPending('cancelPlan')}>
              Move to free tier
            </Button>
          </div>
        ) : (
          <p className="muted">Free tier.</p>
        )}
        {plans.result.state === 'loading' && <Loading rows={1} />}
        {plans.result.state === 'failed' && <Failed error={plans.result.error} onRetry={plans.reload} />}
        {plans.result.state === 'loaded' && (
          <GrantForm
            user={user}
            plans={plans.result.value.plans}
            onGranted={(updated) => {
              onChange(updated)
              toast(`Moved to ${updated.subscription?.planName ?? 'the plan'}`)
            }}
          />
        )}
      </section>

      <section className="panel-section" aria-labelledby="access-title">
        <h3 id="access-title">Access</h3>
        <div className="action-row">
          {user.status === 'ACTIVE' ? (
            <Button variant="danger" onClick={() => setPending('suspend')}>
              Suspend account
            </Button>
          ) : (
            <Button onClick={() => setPending('restore')}>Restore account</Button>
          )}

        </div>
      </section>

      <Confirm
        open={confirm !== null}
        onClose={() => setPending(null)}
        title={confirm?.title ?? ''}
        body={confirm?.body}
        action={confirm?.action ?? ''}
        danger={confirm?.danger}
        onConfirm={() => confirm?.run() ?? Promise.resolve()}
      />
    </div>
  )
}

/** Today in the admin's own calendar, as YYYY-MM-DD for a date input. */
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function GrantForm({
  user,
  plans,
  onGranted,
}: {
  user: AdminUser
  plans: AdminPlan[]
  onGranted: (user: AdminUser) => void
}) {
  const [planId, setPlanId] = useState(plans.find((p) => p.active)?.id ?? plans[0]?.id ?? '')
  const [endsOn, setEndsOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (plans.length === 0) return <p className="field-hint">Create a plan first to put learners on it.</p>

  return (
    <form
      className="grant-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          // The plan lasts through the whole end day, in the admin's time zone.
          const endsAt = endsOn ? new Date(`${endsOn}T23:59:59`).toISOString() : undefined
          onGranted(await api.put<AdminUser>(`v1/admin/users/${user.id}/subscription`, { planId, endsAt }))
          setEndsOn('')
        } catch (err) {
          setError(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label={user.subscription ? 'Change plan' : 'Put on a plan'}>
        {(props) => (
          <select {...props} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.active ? '' : ' (not offered)'}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Ends on" hint="Leave empty for no end date.">
        {(props) => <input {...props} type="date" min={today()} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />}
      </Field>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" variant="primary" busy={busy}>
        {user.subscription ? 'Change plan' : 'Put on plan'}
      </Button>
    </form>
  )
}
