import { FAILURES_BEFORE_LOCK, LOCK_MS } from './policy'

export type LoginState = {
  failures: number
  lockedUntil: Date | null
}

export function effectiveState(state: LoginState, now: Date): LoginState {
  if (state.lockedUntil && state.lockedUntil.getTime() <= now.getTime()) {
    return { failures: 0, lockedUntil: null }
  }
  return state
}

export function isLocked(state: LoginState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
}

export function applyFailure(state: LoginState, now: Date): LoginState {
  const failures = state.failures + 1
  if (failures >= FAILURES_BEFORE_LOCK) {
    return { failures, lockedUntil: new Date(now.getTime() + LOCK_MS) }
  }
  return { failures, lockedUntil: null }
}

export type LoginDecision =
  | { outcome: 'locked'; state: LoginState; lockedUntil: Date }
  | { outcome: 'invalid_credentials'; state: LoginState }
  | { outcome: 'email_not_confirmed'; state: LoginState }
  | { outcome: 'authenticated'; state: LoginState }

export function decideLogin(input: {
  now: Date
  state: LoginState
  passwordMatches: boolean
  emailConfirmed: boolean
}): LoginDecision {
  const state = effectiveState(input.state, input.now)
  if (isLocked(state, input.now) && state.lockedUntil) {
    return { outcome: 'locked', state, lockedUntil: state.lockedUntil }
  }
  if (!input.passwordMatches) {
    const next = applyFailure(state, input.now)
    if (isLocked(next, input.now) && next.lockedUntil) {
      return { outcome: 'locked', state: next, lockedUntil: next.lockedUntil }
    }
    return { outcome: 'invalid_credentials', state: next }
  }
  const clean: LoginState = { failures: 0, lockedUntil: null }
  if (!input.emailConfirmed) return { outcome: 'email_not_confirmed', state: clean }
  return { outcome: 'authenticated', state: clean }
}
