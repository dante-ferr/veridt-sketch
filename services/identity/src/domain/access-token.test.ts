import { describe, expect, it } from 'vitest'
import { ACCESS_TOKEN_TTL_SECONDS, accessTokenExpiry } from './policy'

describe('access token ttl', () => {
  it('is 15 minutes, the maximum for this slice', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60)
    expect(ACCESS_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(15 * 60)
    const issuedAt = new Date('2026-11-07T12:00:00.000Z')
    expect(accessTokenExpiry(issuedAt).getTime() - issuedAt.getTime()).toBe(15 * 60 * 1000)
  })
})
