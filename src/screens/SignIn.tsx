import { useEffect, useRef, useState } from 'react'
import { Notice } from '../components/ui'
import { loadGoogle } from '../google'

export function SignIn({ onSignIn, notice }: { onSignIn: (idToken: string) => Promise<void>; notice?: string }) {
  const button = useRef<HTMLDivElement>(null)
  const callback = useRef(onSignIn)
  callback.current = onSignIn
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGoogle().then((google) => {
      if (cancelled || !button.current) return
      google.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          if (cancelled || inFlight.current) return
          inFlight.current = true
          setBusy(true)
          setError(null)
          try {
            await callback.current(credential)
          } catch (err) {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
          } finally {
            inFlight.current = false
            if (!cancelled) setBusy(false)
          }
        },
      })
      google.renderButton(button.current, { theme: 'outline', size: 'large', text: 'signin_with' })
      setReady(true)
    }).catch((err: Error) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true; button.current?.replaceChildren() }
  }, [clientId])

  return (
    <div className="signin">
      <div className="signin-mark" aria-hidden><span lang="zh-Hans">汉</span></div>
      <div className="signin-card">
        <div className="signin-brand">
          <img src="/hanvo-logo.png" alt="" width={40} height={40} />
          <div>
            <h1>HANVO Admin</h1>
            <p className="muted">Topics, lessons, plans and learner accounts.</p>
          </div>
        </div>
        {(error ?? notice) && <Notice>{error ?? notice}</Notice>}
        {!clientId ? <Notice>Google sign-in is not configured. Contact your administrator.</Notice> : (
          <>
            <div ref={button} hidden={busy} />
            {(!ready || busy) && <p role="status">{busy ? 'Signing in…' : 'Loading Google sign-in…'}</p>}
          </>
        )}
        <p className="field-hint">Sign in with your authorized Google account. Access is limited to approved staff emails.</p>
      </div>
    </div>
  )
}
