import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

export function signRaw(secret: string, raw: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex')
}

export function signatureMatches(secret: string, raw: string, provided: string | undefined): boolean {
  const expected = signRaw(secret, raw)
  const left = createHash('sha256').update(provided ?? '').digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right) && Boolean(provided)
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item))
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
    return Object.fromEntries(entries.map(([key, item]) => [key, sortValue(item)]))
  }
  return value
}
