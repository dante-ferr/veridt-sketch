import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'

export const RECORD_STATES = ['NA_FILA', 'EM_ANDAMENTO', 'CONCLUIDO', 'FALHOU', 'CANCELADO'] as const
export type RecordState = (typeof RECORD_STATES)[number]
export type CaptureKind = 'screenshot' | 'navigation_video'

export const CLOCK_ALERT_MS = 1000
export const DOWNLOAD_LINK_TTL_SECONDS = 5 * 60
export const VIDEO_SESSION_LIMIT_MS = 15 * 60 * 1000
/** A video session with no screen connected for this long fails with connection_lost (ADR-005). */
export const VIDEO_SESSION_DISCONNECT_GRACE_MS = 30_000
export const PAGE_LOAD_TIMEOUT_MS = 30_000

export type ManifestFile = {
  name: string
  mediaType: string
  byteSize: number
  sha256: string
  storageKey: string
}

export type TlsCertificate = {
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  protocol: string
}

export type CaptureMetadata = {
  siteAddress: string
  dnsAnswers: string[]
  tls: TlsCertificate | null
  httpStatus: number
  httpHeaders: Record<string, string>
  pageHtmlSha256: string
  browserVersion: string
  clockOffsetMs: number | null
}

export type Manifest = {
  recordId: string
  publicId: string
  accountId: string
  url: string
  title: string
  startedAt: string
  finishedAt: string
  files: ManifestFile[]
  metadata: CaptureMetadata
}

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function manifestHash(manifest: Manifest): string {
  return sha256Hex(Buffer.from(canonicalJson(manifest), 'utf8'))
}

export function signManifest(canonical: string, privateKeyPem: string): string {
  return sign(null, Buffer.from(canonical, 'utf8'), createPrivateKey(privateKeyPem)).toString('base64')
}

export function verifyManifest(canonical: string, signature: string, publicKeyPem: string): boolean {
  try {
    return verify(null, Buffer.from(canonical, 'utf8'), createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

export function checksumBase64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64')
}

export function checksumHex(base64: string): string {
  return Buffer.from(base64, 'base64').toString('hex')
}

export function initialState(kind: CaptureKind): RecordState {
  return kind === 'screenshot' ? 'NA_FILA' : 'EM_ANDAMENTO'
}

export function beginScreenshot(state: RecordState): 'EM_ANDAMENTO' | 'rejected' {
  return state === 'NA_FILA' ? 'EM_ANDAMENTO' : 'rejected'
}

export function failCapture(state: RecordState): 'FALHOU' | 'rejected' {
  if (state === 'NA_FILA' || state === 'EM_ANDAMENTO') return 'FALHOU'
  return 'rejected'
}

export function cancelCapture(state: RecordState): 'CANCELADO' | 'rejected' {
  if (state === 'NA_FILA' || state === 'EM_ANDAMENTO') return 'CANCELADO'
  return 'rejected'
}

export function concludeCapture(state: RecordState): 'CONCLUIDO' | 'rejected' {
  return state === 'EM_ANDAMENTO' ? 'CONCLUIDO' : 'rejected'
}

export function canPackageEvidence(state: RecordState): boolean {
  return state === 'CONCLUIDO'
}

export function clockNeedsAlert(offsetMs: number | null): boolean {
  if (offsetMs === null) return true
  return Math.abs(offsetMs) >= CLOCK_ALERT_MS
}

export function isPublicHttpUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false
  if (host === 'metadata.google.internal') return false
  if (isIp(host) && !isPublicIp(host)) return false
  return true
}

export function isPublicIp(address: string): boolean {
  const value = address.toLowerCase()
  if (value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return false
  if (value.includes(':')) return true
  const parts = value.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return false
  return true
}

export function hashesMatchStored(manifest: Manifest, stored: Record<string, string>): boolean {
  return manifest.files.every((file) => stored[file.storageKey] === file.sha256)
}

export function publicKeyPem(key: KeyObject): string {
  const exported = key.export({ type: 'spki', format: 'pem' })
  return typeof exported === 'string' ? exported : exported.toString('utf8')
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) sorted[key] = sortKeys(source[key])
    return sorted
  }
  return value
}

function isIp(host: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')
}
