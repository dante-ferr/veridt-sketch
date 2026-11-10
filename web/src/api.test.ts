import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import {
  accessStorageKey,
  accessTokenExpired,
  configureSessionStore,
  refreshStorageKey,
  type TokenStorage,
} from './session-store'

function memory(initial: Record<string, string> = {}): TokenStorage {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

function jwt(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `h.${payload}.s`
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('authenticated api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes once after 401 and retries the request', async () => {
    const store = memory({
      [refreshStorageKey]: 'refresh-token',
      [accessStorageKey]: 'expired-access',
    })
    configureSessionStore(store)
    let refreshes = 0
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const authorization = new Headers(init?.headers).get('authorization')
      if (url === '/v1/sessions/refresh') {
        refreshes += 1
        return json(200, { accessToken: 'fresh-access' })
      }
      if (authorization === 'Bearer fresh-access') return json(200, { title: 'Registro' })
      return json(401, { error: 'unauthenticated' })
    })

    const body = await api<{ title: string }>('/v1/records/record-id', { token: 'expired-access' })

    expect(body.title).toBe('Registro')
    expect(refreshes).toBe(1)
    expect(store.getItem(refreshStorageKey)).toBe('refresh-token')
    expect(store.getItem(accessStorageKey)).toBe('fresh-access')
  })

  it('shares one refresh across parallel 401 responses', async () => {
    const store = memory({
      [refreshStorageKey]: 'refresh-token',
      [accessStorageKey]: 'expired-access',
    })
    configureSessionStore(store)
    let refreshes = 0
    let unauthorized = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const authorization = new Headers(init?.headers).get('authorization')
      if (url === '/v1/sessions/refresh') {
        refreshes += 1
        await gate
        return json(200, { accessToken: 'fresh-access' })
      }
      if (authorization === 'Bearer fresh-access') return json(200, { ok: true })
      unauthorized += 1
      return json(401, { error: 'unauthenticated' })
    })

    const pending = Promise.all([
      api('/v1/records/one', { token: 'expired-access' }),
      api('/v1/records/two', { token: 'expired-access' }),
    ])
    await vi.waitFor(() => {
      expect(unauthorized).toBe(2)
      expect(refreshes).toBe(1)
    })
    release()

    await pending
    expect(refreshes).toBe(1)
    expect(store.getItem(refreshStorageKey)).toBe('refresh-token')
  })

  it('keeps the session when the resource responds 403', async () => {
    const store = memory({
      [refreshStorageKey]: 'refresh-token',
      [accessStorageKey]: 'access-token',
    })
    configureSessionStore(store)
    let refreshes = 0
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/v1/sessions/refresh') refreshes += 1
      return json(403, { error: 'email_not_confirmed' })
    })

    await expect(api('/v1/records/record-id', { token: 'access-token' })).rejects.toMatchObject({
      status: 403,
      code: 'email_not_confirmed',
    })
    expect(refreshes).toBe(0)
    expect(store.getItem(refreshStorageKey)).toBe('refresh-token')
    expect(store.getItem(accessStorageKey)).toBe('access-token')
  })

  it('keeps the refresh token when renewal is rate limited', async () => {
    const store = memory({
      [refreshStorageKey]: 'refresh-token',
      [accessStorageKey]: 'expired-access',
    })
    configureSessionStore(store)
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/v1/sessions/refresh') return json(429, { error: 'too_many_requests' })
      return json(401, { error: 'unauthenticated' })
    })

    await expect(api('/v1/records/record-id', { token: 'expired-access' })).rejects.toMatchObject({
      status: 429,
      code: 'too_many_requests',
    })
    expect(store.getItem(refreshStorageKey)).toBe('refresh-token')
    expect(store.getItem(accessStorageKey)).toBe('expired-access')
  })

  it('drops the session when the retried request is still 401', async () => {
    const store = memory({
      [refreshStorageKey]: 'refresh-token',
      [accessStorageKey]: 'expired-access',
    })
    configureSessionStore(store)
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/v1/sessions/refresh') return json(200, { accessToken: 'fresh-access' })
      return json(401, { error: 'unauthenticated' })
    })

    await expect(api('/v1/records/record-id', { token: 'expired-access' })).rejects.toMatchObject({ status: 401 })
    expect(store.getItem(refreshStorageKey)).toBeNull()
    expect(store.getItem(accessStorageKey)).toBeNull()
  })

  it('drops the session when the refresh token is rejected', async () => {
    const store = memory({
      [refreshStorageKey]: 'refresh-token',
      [accessStorageKey]: 'expired-access',
    })
    configureSessionStore(store)
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/v1/sessions/refresh') return json(401, { error: 'unauthenticated' })
      return json(401, { error: 'unauthenticated' })
    })

    await expect(api('/v1/records/record-id', { token: 'expired-access' })).rejects.toMatchObject({ status: 401 })
    expect(store.getItem(refreshStorageKey)).toBeNull()
    expect(store.getItem(accessStorageKey)).toBeNull()
  })

  it('does not refresh a login failure', async () => {
    configureSessionStore(memory())
    let refreshes = 0
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input) === '/v1/sessions/refresh') refreshes += 1
      return json(401, { error: 'invalid_credentials' })
    })

    await expect(api('/v1/sessions', { method: 'POST', body: { email: 'a@b.c', password: 'senha' } })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    })
    expect(refreshes).toBe(0)
  })
})

describe('access token expiry', () => {
  const now = 1_700_000_000_000

  it('treats a token inside the skew window as expired', () => {
    expect(accessTokenExpired(jwt(Math.floor(now / 1000) + 120), now)).toBe(false)
    expect(accessTokenExpired(jwt(Math.floor(now / 1000) + 10), now)).toBe(true)
    expect(accessTokenExpired(jwt(Math.floor(now / 1000) - 5), now)).toBe(true)
    expect(accessTokenExpired('not-a-jwt', now)).toBe(true)
  })
})
