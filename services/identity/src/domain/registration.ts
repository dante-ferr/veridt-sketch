export const MIN_PASSWORD_LENGTH = 8

export function validatePassword(password: string, confirmation: string): 'ok' | 'too_short' | 'mismatch' {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too_short'
  if (password !== confirmation) return 'mismatch'
  return 'ok'
}

export function isAcceptableName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= 3 && trimmed.length <= 160 && !/[\u0000-\u001F]/.test(trimmed)
}

export function isAcceptableEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function normalizeOab(value: string): string | null {
  const match = value.trim().toUpperCase().replace(/\s+/g, ' ').match(/^([A-Z]{2})\s?(\d{1,6})$/)
  if (!match) return null
  return `${match[1]} ${match[2]}`
}
