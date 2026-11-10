/** ISO timestamp from the capture API shown as-is in UTC ("2026-11-10 19:19:00"); "–" when absent. */
export function formatIsoUtc(value: string | null): string {
  if (!value) return '–'
  return value.replace('T', ' ').replace('.000Z', '').replace('Z', '')
}

/** Any date string rendered as "YYYY-MM-DD HH:MM:SS UTC". */
export function formatDateTimeUtc(value: string): string {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

/** Amount in cents as "R$ 1.234,56". */
export function formatBrl(cents: number): string {
  const reais = Math.floor(cents / 100).toLocaleString('pt-BR')
  const fraction = String(Math.abs(cents) % 100).padStart(2, '0')
  return `R$ ${reais},${fraction}`
}

/** Time left until expiresAt as "M:SS", or "00:00" once expired. */
export function formatRemaining(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now()
  if (ms <= 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
