import { useCallback, useEffect, useRef, useState } from 'react'

export type Loadable<T> =
  | { state: 'loading' }
  | { state: 'failed'; error: unknown }
  | { state: 'loaded'; value: T }

/**
 * Loads `load()` whenever `deps` change and ignores answers that arrive after a newer request started.
 * `reload` keeps the current value on screen while it refreshes; `set` replaces it after a local edit.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [result, setResult] = useState<Loadable<T>>({ state: 'loading' })
  const latest = useRef(0)

  const run = useCallback((keepValue: boolean) => {
    const request = ++latest.current
    if (!keepValue) setResult({ state: 'loading' })
    load().then(
      (value) => request === latest.current && setResult({ state: 'loaded', value }),
      (error) => request === latest.current && setResult({ state: 'failed', error }),
    )
  }, deps)

  useEffect(() => run(false), [run])

  return {
    result,
    reload: () => run(true),
    set: (value: T) => setResult({ state: 'loaded', value }),
  }
}

export function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}
