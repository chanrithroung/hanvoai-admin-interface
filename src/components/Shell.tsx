import type { ReactNode } from 'react'
import { BookOpenText, LayoutDashboard, LogOut, ReceiptText, Users } from 'lucide-react'
import { href, type Route } from '../router'
import type { Me } from '../types'

const sections = [
  { page: 'overview', label: 'Overview', to: href.overview, icon: LayoutDashboard },
  { page: 'learners', label: 'Learners', to: href.learners, icon: Users },
  { page: 'topics', label: 'Topics', to: href.topics, icon: BookOpenText },
  { page: 'plans', label: 'Plans', to: href.plans, icon: ReceiptText },
] as const

export function Shell({
  route,
  me,
  onSignOut,
  children,
}: {
  route: Route
  me: Me
  onSignOut: () => void
  children: ReactNode
}) {
  const current = route.page === 'topic' ? 'topics' : route.page
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href={href.overview}>
          <img src="/hanvo-logo.png" alt="" width={32} height={32} />
          <span className="brand-name">HANVO</span>
          <span className="brand-tag">Admin</span>
        </a>
        <nav aria-label="Sections">
          <ul>
            {sections.map(({ page, label, to, icon: Icon }) => (
              <li key={page}>
                <a href={to} className="nav-link" aria-current={current === page ? 'page' : undefined}>
                  <Icon size={18} aria-hidden />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="account">
          <div className="account-who">
            <span className="account-name">{me.displayName}</span>
            {me.email && <span className="account-email">{me.email}</span>}
          </div>
          <button type="button" className="icon-button" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </aside>
      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
