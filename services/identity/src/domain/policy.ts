// Keep ACCESS_TOKEN_TTL_SECONDS aligned with MAX_ACCESS_TOKEN_TTL_SECONDS in @veridt/auth.
export const FAILURES_BEFORE_LOCK = 5
export const LOCK_MS = 15 * 60 * 1000
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000
export const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000
export const PASSWORD_RESET_REQUEST_LIMIT = 5
export const PASSWORD_RESET_WINDOW_MS = 15 * 60 * 1000

export function accessTokenExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000)
}

export function refreshExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + REFRESH_TTL_MS)
}

export function canRequestPasswordReset(requestsInWindow: number): boolean {
  return requestsInWindow < PASSWORD_RESET_REQUEST_LIMIT
}
