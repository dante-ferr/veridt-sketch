export const refreshStorageKey = 'veridit.refresh'
export const accessStorageKey = 'veridit.access'

const refreshSkewMs = 30_000

export type TokenStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type SessionSnapshot = {
  accessToken: string
  fullName: string
  pending: boolean
  error: string
}

function memoryStorage(): TokenStorage {
  const data = new Map<string, string>()
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

function createDefaultStorage(): TokenStorage {
  if (typeof sessionStorage !== 'undefined') return sessionStorage
  return memoryStorage()
}

let storage = createDefaultStorage()
let snapshot: SessionSnapshot = {
  accessToken: storage.getItem(accessStorageKey) ?? '',
  fullName: '',
  pending: false,
  error: '',
}
let refreshInflight: Promise<string> | null = null
const listeners = new Set<() => void>()
const lostListeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function configureSessionStore(next: TokenStorage): void {
  storage = next
  refreshInflight = null
  snapshot = {
    accessToken: next.getItem(accessStorageKey) ?? '',
    fullName: '',
    pending: false,
    error: '',
  }
  listeners.clear()
  lostListeners.clear()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): SessionSnapshot {
  return snapshot
}

export function onSessionLost(listener: () => void): () => void {
  lostListeners.add(listener)
  return () => lostListeners.delete(listener)
}

export function readRefreshToken(): string {
  return storage.getItem(refreshStorageKey) ?? ''
}

export function readAccessToken(): string {
  const accessToken = storage.getItem(accessStorageKey) ?? ''
  if (accessToken !== snapshot.accessToken) {
    snapshot = { ...snapshot, accessToken }
    notify()
  }
  return accessToken
}

export function saveSession(accessToken: string, refreshToken: string): void {
  storage.setItem(refreshStorageKey, refreshToken)
  storage.setItem(accessStorageKey, accessToken)
  snapshot = { accessToken, fullName: '', pending: false, error: '' }
  notify()
}

export function writeAccessToken(accessToken: string): void {
  storage.setItem(accessStorageKey, accessToken)
  snapshot = { ...snapshot, accessToken }
  notify()
}

export function setFullName(fullName: string): void {
  if (snapshot.fullName === fullName) return
  snapshot = { ...snapshot, fullName }
  notify()
}

export function setSessionPending(pending: boolean): void {
  snapshot = { ...snapshot, pending, error: pending ? '' : snapshot.error }
  notify()
}

export function setSessionError(error: string): void {
  snapshot = { ...snapshot, pending: false, error }
  notify()
}

export function loseSession(): void {
  storage.removeItem(refreshStorageKey)
  storage.removeItem(accessStorageKey)
  snapshot = { accessToken: '', fullName: '', pending: false, error: '' }
  notify()
  for (const listener of lostListeners) listener()
}

export function singleFlightRefresh(run: () => Promise<string>): Promise<string> {
  if (!refreshInflight) {
    refreshInflight = run().finally(() => {
      refreshInflight = null
    })
  }
  return refreshInflight
}

export function accessTokenExpired(token: string, now = Date.now()): boolean {
  const part = token.split('.')[1]
  if (!part) return true
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const payload = JSON.parse(atob(padded + pad)) as { exp?: unknown }
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= now + refreshSkewMs
  } catch {
    return true
  }
}
