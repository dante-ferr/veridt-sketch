export type RefreshState = {
  expiresAt: Date
  revokedAt: Date | null
}

export function revokeRefresh(state: RefreshState, now: Date): RefreshState {
  return { ...state, revokedAt: now }
}

export function refreshAllowsRenewal(state: RefreshState, now: Date): boolean {
  if (state.revokedAt !== null) return false
  return state.expiresAt.getTime() > now.getTime()
}
