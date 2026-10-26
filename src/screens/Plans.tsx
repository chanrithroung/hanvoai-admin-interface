import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api, APIError, errorMessage } from '../api'
import { Button, Confirm, Dialog, Empty, Failed, Field, Loading, Notice, PageHeader, Switch, useToast } from '../components/ui'
import { count, price, voiceMinutes } from '../format'
import { useLoad } from '../hooks'
import type { AdminPlan, BillingPeriod, PlanRequest, PlansResponse } from '../types'

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')

export function Plans() {
  const { result, reload, set } = useLoad(() => api.get<PlansResponse>('v1/admin/plans'), [])
  // null: closed, 'new': creating, otherwise the plan being edited.
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null)

  const replace = (plans: AdminPlan[]) => result.state === 'loaded' && set({ ...result.value, plans })

  return (
    <>
      <PageHeader
        title="Plans"
        lead="Daily limits for each plan. Changes apply to subscribers from their next request."
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setEditing('new')}>
            New plan
          </Button>
        }
      />

      {result.state === 'loading' && <Loading rows={5} />}
      {result.state === 'failed' && <Failed error={result.error} onRetry={reload} />}
      {result.state === 'loaded' && (
        <>
          <section className="panel free-tier" aria-labelledby="free-title">
            <div>
              <h2 id="free-title">Free tier</h2>
              <p className="muted">
                Everyone without a plan. Set on the server with the <code>QUOTA_DAILY_*</code> variables.
              </p>
            </div>
            <dl className="limits">
              <div>
                <dt>Text turns</dt>
                <dd className="num">{count(result.value.freeTier.dailyTextTurns)}</dd>
              </div>
              <div>
                <dt>Translations</dt>
                <dd className="num">{count(result.value.freeTier.dailyTranslations)}</dd>
              </div>
              <div>
                <dt>Voice</dt>
                <dd className="num">{voiceMinutes(result.value.freeTier.dailyVoiceSeconds)}</dd>
              </div>
            </dl>
          </section>

          {result.value.plans.length === 0 ? (
            <Empty title="No plans yet">
              <p className="muted">Create a plan to give learners higher daily limits.</p>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">Price</th>
                    <th scope="col" className="num">Text turns / day</th>
                    <th scope="col" className="num">Translations / day</th>
                    <th scope="col" className="num">Voice / day</th>
                    <th scope="col" className="num">Subscribers</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.value.plans.map((p) => (
                    <tr key={p.id} className="row-link" onClick={() => setEditing(p)}>
                      <th scope="row">
                        <button type="button" className="cell-button" onClick={() => setEditing(p)}>
                          <span className="cell-title">{p.name}</span>
                          <span className="cell-sub">{p.description || <span className="mono">{p.id}</span>}</span>
                        </button>
                      </th>
                      <td>{price(p.priceCents, p.currency, p.billingPeriod)}</td>
                      <td className="num">{count(p.dailyTextTurns)}</td>
                      <td className="num">{count(p.dailyTranslations)}</td>
                      <td className="num">{voiceMinutes(p.dailyVoiceSeconds)}</td>
                      <td className="num">{count(p.subscribers)}</td>
                      <td>
                        {p.active ? (
                          <span className="status status-ok">Offered</span>
                        ) : (
                          <span className="status status-off">Not offered</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Dialog
            open={editing !== null}
            onClose={() => setEditing(null)}
            side
            title={editing === 'new' ? 'New plan' : (editing?.name ?? '')}
            description={
              editing && editing !== 'new'
                ? `${count(editing.subscribers)} ${editing.subscribers === 1 ? 'subscriber' : 'subscribers'}`
                : undefined
            }
          >
            {editing !== null && (
              <PlanForm
                key={editing === 'new' ? 'new' : editing.id}
                plan={editing === 'new' ? null : editing}
                onSaved={(plan) => {
                  const plans = result.value.plans
                  replace(
                    editing === 'new'
                      ? [...plans, plan].sort((a, b) => a.sortOrder - b.sortOrder)
                      : // The update answer doesn't count subscribers, so keep the count we already have.
                        plans
                          .map((p) => (p.id === plan.id ? { ...plan, subscribers: p.subscribers } : p))
                          .sort((a, b) => a.sortOrder - b.sortOrder),
                  )
                  setEditing(null)
                }}
                onDeleted={(id) => {
                  replace(result.value.plans.filter((p) => p.id !== id))
                  setEditing(null)
                }}
              />
            )}
          </Dialog>
        </>
      )}
    </>
  )
}

type Form = Omit<PlanRequest, 'priceCents' | 'dailyVoiceSeconds'> & { price: string; voiceMinutes: string }

const formOf = (p: AdminPlan | null): Form => ({
  id: p?.id ?? '',
  name: p?.name ?? '',
  description: p?.description ?? '',
  price: p ? (p.priceCents / 100).toFixed(2) : '',
  currency: p?.currency ?? 'USD',
  billingPeriod: p?.billingPeriod ?? 'MONTHLY',
  dailyTextTurns: p?.dailyTextTurns ?? 200,
  dailyTranslations: p?.dailyTranslations ?? 300,
  voiceMinutes: p ? String(p.dailyVoiceSeconds / 60) : '30',
  active: p?.active ?? true,
  sortOrder: p?.sortOrder ?? 100,
})

function PlanForm({
  plan,
  onSaved,
  onDeleted,
}: {
  plan: AdminPlan | null
  onSaved: (plan: AdminPlan) => void
  onDeleted: (id: string) => void
}) {
  const toast = useToast()
  const [form, setForm] = useState(() => formOf(plan))
  const [idEdited, setIdEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [deleting, setDeleting] = useState(false)
  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const fieldError = (name: string) => (error instanceof APIError ? error.fields[name] : undefined)

  const save = async () => {
    setBusy(true)
    setError(null)
    const { price: amount, voiceMinutes: minutes, ...rest } = form
    const body: PlanRequest = {
      ...rest,
      priceCents: Math.round(Number(amount || 0) * 100),
      dailyVoiceSeconds: Math.round(Number(minutes || 0) * 60),
    }
    try {
      const saved = plan
        ? await api.put<AdminPlan>(`v1/admin/plans/${encodeURIComponent(plan.id)}`, body)
        : await api.post<AdminPlan>('v1/admin/plans', body)
      toast(plan ? 'Plan saved' : 'Plan created')
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(errorMessage(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Name" error={fieldError('name')}>
        {(p) => (
          <input
            {...p}
            required
            maxLength={60}
            value={form.name}
            onChange={(e) =>
              update({ name: e.target.value, ...(!plan && !idEdited ? { id: slugify(e.target.value) } : {}) })
            }
          />
        )}
      </Field>
      <Field label="Plan id" error={fieldError('id')} hint={plan ? 'Permanent.' : 'It can’t be changed later.'}>
        {(p) => (
          <input
            {...p}
            className="mono"
            required={!plan}
            readOnly={plan !== null}
            maxLength={40}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            spellCheck={false}
            value={form.id}
            onChange={(e) => {
              setIdEdited(true)
              update({ id: e.target.value })
            }}
          />
        )}
      </Field>
      <Field label="Description" error={fieldError('description')} hint="Shown to learners when they compare plans.">
        {(p) => (
          <textarea {...p} rows={2} maxLength={300} value={form.description}
            onChange={(e) => update({ description: e.target.value })} />
        )}
      </Field>

      <div className="form-row">
        <Field label="Price" error={fieldError('priceCents')}>
          {(p) => (
            <input {...p} type="number" inputMode="decimal" min={0} step="0.01" required value={form.price}
              onChange={(e) => update({ price: e.target.value })} />
          )}
        </Field>
        <Field label="Currency" error={fieldError('currency')}>
          {(p) => (
            <input {...p} className="mono" required maxLength={3} pattern="[A-Z]{3}" value={form.currency}
              onChange={(e) => update({ currency: e.target.value.toUpperCase() })} />
          )}
        </Field>
        <Field label="Billed" error={fieldError('billingPeriod')}>
          {(p) => (
            <select {...p} value={form.billingPeriod}
              onChange={(e) => update({ billingPeriod: e.target.value as BillingPeriod })}>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          )}
        </Field>
      </div>

      <fieldset className="fieldset">
        <legend>Daily limits</legend>
        <div className="form-row">
          <Field label="Text turns" error={fieldError('dailyTextTurns')}>
            {(p) => (
              <input {...p} type="number" min={0} max={100000} required value={form.dailyTextTurns}
                onChange={(e) => update({ dailyTextTurns: e.target.valueAsNumber || 0 })} />
            )}
          </Field>
          <Field label="Translations" error={fieldError('dailyTranslations')}>
            {(p) => (
              <input {...p} type="number" min={0} max={100000} required value={form.dailyTranslations}
                onChange={(e) => update({ dailyTranslations: e.target.valueAsNumber || 0 })} />
            )}
          </Field>
          <Field label="Voice minutes" error={fieldError('dailyVoiceSeconds')}>
            {(p) => (
              <input {...p} type="number" min={0} max={1440} step="0.5" required value={form.voiceMinutes}
                onChange={(e) => update({ voiceMinutes: e.target.value })} />
            )}
          </Field>
        </div>
      </fieldset>

      <div className="form-row">
        <Field label="Sort order" hint="Lower numbers come first." error={fieldError('sortOrder')}>
          {(p) => (
            <input {...p} type="number" min={0} max={10000} required value={form.sortOrder}
              onChange={(e) => update({ sortOrder: e.target.valueAsNumber || 0 })} />
          )}
        </Field>
        <div className="field field-switch">
          <Switch checked={form.active} onChange={(active) => update({ active })} label="Offered to learners" />
          <p className="field-hint">
            {form.active ? 'Learners can choose it.' : 'Current subscribers keep it; nobody new can choose it.'}
          </p>
        </div>
      </div>

      {error && <Notice>{error.message}</Notice>}
      <footer className="form-footer">
        {plan && (
          <Button variant="ghost" icon={<Trash2 size={16} aria-hidden />} onClick={() => setDeleting(true)}>
            Delete plan
          </Button>
        )}
        <span className="form-footer-gap" />
        <Button type="submit" variant="primary" busy={busy}>
          {plan ? 'Save plan' : 'Create plan'}
        </Button>
      </footer>

      {plan && (
        <Confirm
          open={deleting}
          onClose={() => setDeleting(false)}
          title={`Delete “${plan.name}”?`}
          body="Plans that anyone has ever been on can’t be deleted, so their history stays intact. Stop offering it instead."
          action="Delete plan"
          danger
          onConfirm={async () => {
            await api.delete(`v1/admin/plans/${encodeURIComponent(plan.id)}`)
            toast('Plan deleted')
            onDeleted(plan.id)
          }}
        />
      )}
    </form>
  )
}
