import { useEffect, useState } from 'react'

// Hash routes, so the dashboard can be served as static files from any path without server rewrites.
export type Route =
  | { page: 'overview' }
  | { page: 'learners' }
  | { page: 'topics' }
  | { page: 'topic'; id: string | null }
  | { page: 'plans' }

export function parse(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/')
  switch (page) {
    case 'learners':
      return { page: 'learners' }
    case 'topics':
      if (id === 'new') return { page: 'topic', id: null }
      return id ? { page: 'topic', id: decodeURIComponent(id) } : { page: 'topics' }
    case 'plans':
      return { page: 'plans' }
    default:
      return { page: 'overview' }
  }
}

export const href = {
  overview: '#/',
  learners: '#/learners',
  topics: '#/topics',
  newTopic: '#/topics/new',
  topic: (id: string) => `#/topics/${encodeURIComponent(id)}`,
  plans: '#/plans',
}

export const navigate = (to: string) => {
  window.location.hash = to
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const update = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return route
}
