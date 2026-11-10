export type RouteClass = 'public' | 'protected' | 'missing'

const routes: Record<string, RouteClass> = {
  'POST /v1/accounts': 'public',
  'POST /v1/accounts/confirmation': 'public',
  'POST /v1/sessions': 'public',
  'POST /v1/sessions/refresh': 'public',
  'POST /v1/password-recoveries': 'public',
  'POST /v1/password-resets': 'public',
  'GET /v1/keys/jwks': 'public',
  'GET /v1/health': 'public',
  'GET /v1/openapi/identity': 'public',
  'GET /v1/openapi/notification': 'public',
  'GET /v1/openapi/capture': 'public',
  'GET /v1/openapi/records': 'public',
  'GET /v1/capture/signing-key': 'public',
  'POST /v1/captures': 'protected',
  'GET /v1/records': 'protected',
  'GET /v1/me': 'protected',
  'POST /v1/sessions/logout': 'protected',
}

export function classifyRoute(method: string, path: string): RouteClass {
  const clean = path.split('?')[0] ?? path
  const exact = routes[`${method.toUpperCase()} ${clean}`]
  if (exact) return exact
  if (method === 'GET' && /^\/v1\/captures\/[0-9a-f-]{36}$/.test(clean)) return 'protected'
  if (method === 'POST' && /^\/v1\/captures\/[0-9a-f-]{36}\/(cancel|conclude)$/.test(clean)) return 'protected'
  if (method === 'GET' && /^\/v1\/records\/[0-9a-f-]{36}$/.test(clean)) return 'protected'
  if (method === 'POST' && /^\/v1\/records\/[0-9a-f-]{36}\/(downloads|purge)$/.test(clean)) return 'protected'
  return 'missing'
}

export function upstreamFor(path: string): 'identity' | 'capture' | 'records' {
  const clean = path.split('?')[0] ?? path
  if (clean.startsWith('/v1/captures') || clean.startsWith('/v1/capture/') || clean === '/v1/openapi/capture') {
    return 'capture'
  }
  if (clean.startsWith('/v1/records') || clean === '/v1/openapi/records') return 'records'
  return 'identity'
}

export function isRateLimited(method: string, path: string): boolean {
  const key = `${method.toUpperCase()} ${path.split('?')[0] ?? path}`
  return (
    key === 'POST /v1/sessions' ||
    key === 'POST /v1/sessions/refresh' ||
    key === 'POST /v1/password-recoveries' ||
    key === 'POST /v1/password-resets'
  )
}

export const RATE_LIMIT = 20
export const RATE_WINDOW_MS = 60_000

export function tooManyAttempts(
  buckets: Map<string, { count: number; resetAt: number }>,
  key: string,
  now: number,
  limit = RATE_LIMIT,
  windowMs = RATE_WINDOW_MS,
): boolean {
  if (buckets.size > 10_000) buckets.clear()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  current.count += 1
  return current.count > limit
}
