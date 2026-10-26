import type { Me } from './types'

export class APIError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    /** Validation messages by camelCase field name. */
    readonly fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

/** Empty means "same origin": the dev server proxies /v1 to Spring Boot. */
export const apiBaseURL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

// The API speaks snake_case; the dashboard uses camelCase, like the other clients.
const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [convert(k), convertKeys(v, convert)]))
  }
  return value
}

// The refresh token lives for this tab only, so a reload keeps the admin signed in but closing the tab doesn't.
const refreshKey = 'hanvo.admin.refresh'
const storage = {
  get: () => {
    try {
      return sessionStorage.getItem(refreshKey)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) sessionStorage.setItem(refreshKey, token)
      else sessionStorage.removeItem(refreshKey)
    } catch {
      // Without storage the session simply ends on reload.
    }
  },
}

type Tokens = { accessToken: string; refreshToken: string; user: Me }

/**
 * HANVO REST client for staff. Signs in with Google, holds the access token in memory, and renews it
 * with the refresh token when it expires.
 */
class APIClient {
  private accessToken: string | null = null
  private refreshing: Promise<boolean> | null = null
  /** Called when the session can't be renewed, so the app can return to sign-in. */
  onSignedOut: () => void = () => {}

  get hasSession() {
    return this.accessToken !== null || storage.get() !== null
  }

  async signIn(idToken: string): Promise<Me> {
    const tokens = await this.request<Tokens>('POST', 'v1/auth/admin/google', { idToken }, false)
    this.keep(tokens)
    return tokens.user
  }

  async signOut() {
    const refreshToken = storage.get()
    this.accessToken = null
    storage.set(null)
    if (refreshToken) await this.request('POST', 'v1/auth/logout', { refreshToken }, false).catch(() => {})
  }

  get<T>(path: string) {
    return this.send<T>('GET', path)
  }
  post<T>(path: string, body?: object) {
    return this.send<T>('POST', path, body)
  }
  put<T>(path: string, body?: object) {
    return this.send<T>('PUT', path, body)
  }
  patch<T>(path: string, body?: object) {
    return this.send<T>('PATCH', path, body)
  }
  delete(path: string) {
    return this.send<void>('DELETE', path)
  }

  private async send<T>(method: string, path: string, body?: object, isRetry = false): Promise<T> {
    if (!this.accessToken && !(await this.refresh())) {
      this.onSignedOut()
      throw new APIError('UNAUTHENTICATED', 'Sign in to continue.', 401)
    }
    try {
      return await this.request<T>(method, path, body, true)
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        this.accessToken = null
        if (!isRetry) return this.send<T>(method, path, body, true)
        this.onSignedOut()
      }
      throw error
    }
  }

  /** One refresh at a time, however many requests are waiting for it. */
  private refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      const refreshToken = storage.get()
      if (!refreshToken) return false
      try {
        this.keep(await this.request<Tokens>('POST', 'v1/auth/refresh', { refreshToken }, false))
        return true
      } catch {
        storage.set(null)
        return false
      }
    })().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private keep(tokens: Tokens) {
    this.accessToken = tokens.accessToken
    storage.set(tokens.refreshToken)
  }

  private async request<T>(method: string, path: string, body: object | undefined, authenticated: boolean) {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (authenticated && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`

    let response: Response
    try {
      response = await fetch(`${apiBaseURL}/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(convertKeys(body, toSnake)),
      })
    } catch {
      throw new APIError('NETWORK', "Couldn't reach the HANVO API. Check that it's running and try again.", 0)
    }
    if (!response.ok) throw await APIClient.error(response)
    const text = await response.text()
    return (text ? convertKeys(JSON.parse(text), toCamel) : undefined) as T
  }

  private static async error(response: Response): Promise<APIError> {
    try {
      const body = (await response.json()) as { code?: string; message?: string; fields?: Record<string, string> }
      if (body.code && body.message) {
        const fields = Object.fromEntries(Object.entries(body.fields ?? {}).map(([k, v]) => [toCamel(k), v]))
        return new APIError(body.code, body.message, response.status, fields)
      }
    } catch {
      // Fall through to the generic message.
    }
    return new APIError(`HTTP_${response.status}`, `The server answered ${response.status}. Try again.`, response.status)
  }
}

export const api = new APIClient()

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.'
