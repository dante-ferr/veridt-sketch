import { describe, expect, it } from 'vitest'
import { decideLogin, isLocked, type LoginState } from './login'

const now = new Date('2026-11-07T12:00:00.000Z')

describe('login lock', () => {
  it('locks on the fifth consecutive failure for 15 minutes', () => {
    let state: LoginState = { failures: 0, lockedUntil: null }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const decision = decideLogin({ now, state, passwordMatches: false, emailConfirmed: true })
      expect(decision.outcome).toBe('invalid_credentials')
      state = decision.state
    }
    const fifth = decideLogin({ now, state, passwordMatches: false, emailConfirmed: true })
    expect(fifth.outcome).toBe('locked')
    expect(fifth.state.failures).toBe(5)
    expect(isLocked(fifth.state, now)).toBe(true)
    expect(isLocked(fifth.state, new Date(now.getTime() + 15 * 60 * 1000 - 1))).toBe(true)
    expect(isLocked(fifth.state, new Date(now.getTime() + 15 * 60 * 1000))).toBe(false)
  })

  it('does not add a failure while the lock is active', () => {
    const locked: LoginState = {
      failures: 5,
      lockedUntil: new Date(now.getTime() + 15 * 60 * 1000),
    }
    const decision = decideLogin({ now, state: locked, passwordMatches: false, emailConfirmed: true })
    expect(decision.outcome).toBe('locked')
    expect(decision.state.failures).toBe(5)
  })
})
