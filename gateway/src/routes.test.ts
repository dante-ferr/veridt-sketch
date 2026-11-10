import { describe, expect, it } from 'vitest'
import { classifyRoute, tooManyAttempts } from './routes'

describe('routes', () => {
  it('keeps registration, confirmation, login, refresh, and password recovery public', () => {
    expect(classifyRoute('POST', '/v1/accounts')).toBe('public')
    expect(classifyRoute('POST', '/v1/accounts/confirmation')).toBe('public')
    expect(classifyRoute('POST', '/v1/sessions')).toBe('public')
    expect(classifyRoute('POST', '/v1/sessions/refresh')).toBe('public')
    expect(classifyRoute('POST', '/v1/password-recoveries')).toBe('public')
    expect(classifyRoute('POST', '/v1/password-resets')).toBe('public')
    expect(classifyRoute('GET', '/v1/keys/jwks')).toBe('public')
    expect(classifyRoute('GET', '/v1/capture/signing-key')).toBe('public')
  })

  it('protects capture and record routes', () => {
    expect(classifyRoute('POST', '/v1/captures')).toBe('protected')
    expect(classifyRoute('GET', '/v1/captures/4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10')).toBe('protected')
    expect(classifyRoute('POST', '/v1/captures/4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10/cancel')).toBe('protected')
    expect(classifyRoute('GET', '/v1/records')).toBe('protected')
    expect(classifyRoute('POST', '/v1/records/4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10/downloads')).toBe('protected')
    expect(classifyRoute('GET', '/v1/internal/accounts/4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10/report')).toBe('missing')
  })

  it('protects the signed-in routes and rejects unknown ones', () => {
    expect(classifyRoute('GET', '/v1/me')).toBe('protected')
    expect(classifyRoute('POST', '/v1/sessions/logout')).toBe('protected')
    expect(classifyRoute('GET', '/v1/accounts')).toBe('missing')
    expect(classifyRoute('POST', '/v1/me')).toBe('missing')
  })

  it('blocks the request after the limit inside the window', () => {
    const buckets = new Map<string, { count: number; resetAt: number }>()
    for (let n = 0; n < 20; n += 1) {
      expect(tooManyAttempts(buckets, 'ip', 1_000, 20, 60_000)).toBe(false)
    }
    expect(tooManyAttempts(buckets, 'ip', 1_000, 20, 60_000)).toBe(true)
    expect(tooManyAttempts(buckets, 'ip', 61_000, 20, 60_000)).toBe(false)
  })
})
