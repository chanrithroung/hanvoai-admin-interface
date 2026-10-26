import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CircleAlert, LoaderCircle, RotateCw, X } from 'lucide-react'
import { errorMessage } from '../api'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  busy?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'secondary', busy, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`button button-${variant} ${className ?? ''}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? <LoaderCircle className="spin" size={16} aria-hidden /> : icon}
      {children}
    </button>
  )
}

/** A label, the control, and either a hint or the server's validation message for it. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
  className?: string
}) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': note ? noteId : undefined })}
      {note && (
        <p id={noteId} className={error ? 'field-error' : 'field-hint'}>
          {note}
        </p>
      )}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden />
      {label}
    </label>
  )
}

/** A native modal dialog: focus moves into it, Escape closes it, and the page behind is inert. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Slides in from the right instead of sitting in the middle. */
  side?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={side ? 'dialog dialog-side' : 'dialog'}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="dialog-body">
          <header className="dialog-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p className="muted">{description}</p>}
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="dialog-content">{children}</div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

/** Asks before an action that's hard to undo. Shows the server's reason if it refuses. */
export function Confirm({
  open,
  onClose,
  title,
  body,
  action,
  danger,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  body: ReactNode
  action: string
  danger?: boolean
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) setError(null)
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            busy={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onConfirm()
                onClose()
              } catch (e) {
                setError(errorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {action}
          </Button>
        </>
      }
    >
      <div className="muted">{body}</div>
      {error && <Notice>{error}</Notice>}
    </Dialog>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="alert">
      <CircleAlert size={16} aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="state" role="alert">
      <CircleAlert size={22} aria-hidden />
      <p>{errorMessage(error)}</p>
      <Button icon={<RotateCw size={16} aria-hidden />} onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {children}
    </div>
  )
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {lead && <p className="muted">{lead}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

// ---- Toasts

const ToastContext = createContext<(message: string) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null)
  const show = useCallback((text: string) => setMessage({ text, key: Date.now() }), [])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3200)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && (
          <div className="toast" key={message.key}>
            {message.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
