import { useEffect, useState } from 'react'
import { api, APIError } from './api'
import { Shell } from './components/Shell'
import { Loading } from './components/ui'
import { useRoute } from './router'
import { Learners } from './screens/Learners'
import { Overview } from './screens/Overview'
import { Plans } from './screens/Plans'
import { SignIn } from './screens/SignIn'
import { TopicEditor } from './screens/TopicEditor'
import { Topics } from './screens/Topics'
import type { Me } from './types'

type Session = { state: 'checking' } | { state: 'signedOut'; notice?: string } | { state: 'signedIn'; me: Me }

const notAdmin = "This account doesn't have admin access. Ask for it to be added to ADMIN_EMAILS."

/** Signed in, and allowed into /v1/admin. The role is checked on the server, so asking it is the real test. */
async function adminProfile(): Promise<Me> {
  const me = await api.get<Me>('v1/me')
  try {
    await api.get('v1/admin/plans')
  } catch (error) {
    if (error instanceof APIError && error.status === 403) {
      await api.signOut()
      throw new APIError('FORBIDDEN', notAdmin, 403)
    }
    throw error
  }
  return me
}

export function App() {
  const route = useRoute()
  const [session, setSession] = useState<Session>(() =>
    api.hasSession ? { state: 'checking' } : { state: 'signedOut' },
  )

  useEffect(() => {
    api.onSignedOut = () => setSession({ state: 'signedOut', notice: 'Your session ended. Sign in again.' })
    if (session.state !== 'checking') return
    adminProfile().then(
      (me) => setSession({ state: 'signedIn', me }),
      (error) => setSession({ state: 'signedOut', notice: error instanceof Error ? error.message : undefined }),
    )
    // Only on first load; later sign-ins go through SignIn.
  }, [])

  if (session.state === 'checking') {
    return (
      <div className="signin">
        <Loading rows={2} />
      </div>
    )
  }
  if (session.state === 'signedOut') {
    return (
      <SignIn
        notice={session.notice}
        onSignIn={async (idToken) => {
          await api.signIn(idToken)
          setSession({ state: 'signedIn', me: await adminProfile() })
        }}
      />
    )
  }

  return (
    <Shell
      route={route}
      me={session.me}
      onSignOut={async () => {
        await api.signOut()
        setSession({ state: 'signedOut' })
      }}
    >
      {route.page === 'overview' && <Overview />}
      {route.page === 'learners' && <Learners />}
      {route.page === 'topics' && <Topics />}
      {route.page === 'topic' && <TopicEditor key={route.id ?? 'new'} id={route.id} />}
      {route.page === 'plans' && <Plans />}
    </Shell>
  )
}
