import { describe, expect, it } from 'vitest'
import { refreshExpiry } from './policy'
import { refreshAllowsRenewal, revokeRefresh } from './refresh'

describe('refresh token', () => {
  it('lasts 7 days and cannot renew after revocation', () => {
    const now = new Date('2026-11-07T12:00:00.000Z')
    const state = { expiresAt: refreshExpiry(now), revokedAt: null }
    expect(state.expiresAt.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(refreshAllowsRenewal(state, now)).toBe(true)
    expect(refreshAllowsRenewal(revokeRefresh(state, now), now)).toBe(false)
    expect(refreshAllowsRenewal(state, state.expiresAt)).toBe(false)
  })
})
