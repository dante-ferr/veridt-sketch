import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalJson, manifestHash, sha256Hex, verifyManifest, type Manifest } from '@veridit/evidence'
import { acceptError, acceptExecuted, EvidenceObjects, type StoredCapture } from './accept-executed'

class MemoryObjects extends EvidenceObjects {
  readonly objects = new Map<string, { body: Buffer; sha256: string }>()
  puts: string[] = []
  async get(key: string) {
    return this.objects.get(key) ?? null
  }
  async putNew(key: string, body: Buffer, sha256: string) {
    if (this.objects.has(key)) throw new Error('exists')
    this.puts.push(key)
    this.objects.set(key, { body, sha256 })
  }
}

const record: StoredCapture = {
  id: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
  publicId: 'REG-2026-000001',
  accountId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
  fullName: 'Ana Ribeiro',
  email: 'ana@example.com',
  title: 'Página',
  state: 'EM_ANDAMENTO',
  traceId: '11111111-1111-4111-8111-111111111111',
  manifestHash: null,
  signature: null,
}

function manifest(): Manifest {
  const png = Buffer.from('png-bytes')
  const html = Buffer.from('<html>ok</html>')
  return {
    recordId: record.id,
    publicId: record.publicId,
    accountId: record.accountId,
    url: 'https://example.com/a',
    title: record.title,
    startedAt: '2026-11-08T18:00:00.000Z',
    finishedAt: '2026-11-08T18:00:02.000Z',
    files: [
      {
        name: 'capture.png',
        mediaType: 'image/png',
        byteSize: png.length,
        sha256: sha256Hex(png),
        storageKey: `evidence/${record.id}/capture.png`,
      },
      {
        name: 'page.html',
        mediaType: 'text/html',
        byteSize: html.length,
        sha256: sha256Hex(html),
        storageKey: `evidence/${record.id}/page.html`,
      },
    ],
    metadata: {
      siteAddress: '93.184.216.34',
      dnsAnswers: ['93.184.216.34'],
      tls: null,
      httpStatus: 200,
      httpHeaders: { 'content-type': 'text/html' },
      pageHtmlSha256: sha256Hex(html),
      browserVersion: 'Chromium test',
      clockOffsetMs: 4,
    },
  }
}

function load(objects: MemoryObjects, body: Manifest): { key: string; hash: string } {
  const png = Buffer.from('png-bytes')
  const html = Buffer.from('<html>ok</html>')
  objects.objects.set(`evidence/${record.id}/capture.png`, { body: png, sha256: sha256Hex(png) })
  objects.objects.set(`evidence/${record.id}/page.html`, { body: html, sha256: sha256Hex(html) })
  const canonical = canonicalJson(body)
  const key = `evidence/${record.id}/manifest.json`
  objects.objects.set(key, { body: Buffer.from(canonical, 'utf8'), sha256: manifestHash(body) })
  return { key, hash: manifestHash(body) }
}

describe('accept executed capture', () => {
  const pair = generateKeyPairSync('ed25519')
  const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()

  it('signs only when every stored checksum matches the manifest', async () => {
    const objects = new MemoryObjects()
    const loaded = load(objects, manifest())
    const result = await acceptExecuted(
      record,
      { manifestKey: loaded.key, manifestHash: loaded.hash, finishedAt: '2026-11-08T18:00:02.000Z' },
      objects,
      privatePem,
      new Date('2026-11-08T18:00:03.000Z'),
    )
    expect(result.outcome).toBe('concluded')
    if (result.outcome !== 'concluded') return
    const canonical = objects.objects.get(loaded.key)?.body.toString('utf8') ?? ''
    expect(verifyManifest(canonical, result.signature, publicPem)).toBe(true)
    expect(result.events.map((event) => event.type)).toEqual(['CapturaConcluida', 'EventoAuditoria'])
    const completed = result.events[0]
    if (completed?.type === 'CapturaConcluida') expect(completed.data.manifestHash).toBe(loaded.hash)
  })

  it('does not sign when a stored file checksum differs', async () => {
    const objects = new MemoryObjects()
    const loaded = load(objects, manifest())
    objects.objects.set(`evidence/${record.id}/capture.png`, { body: Buffer.from('tampered'), sha256: sha256Hex(Buffer.from('tampered')) })
    const result = await acceptExecuted(
      record,
      { manifestKey: loaded.key, manifestHash: loaded.hash, finishedAt: '2026-11-08T18:00:02.000Z' },
      objects,
      privatePem,
      new Date('2026-11-08T18:00:03.000Z'),
    )
    expect(result.outcome).toBe('failed')
    if (result.outcome === 'failed') expect(result.reason).toBe('file_checksum_mismatch')
    expect(objects.puts).toEqual([])
  })

  it('does not run a failed capture again', () => {
    const again = acceptError({ ...record, state: 'FALHOU' }, 'page_load_failed', new Date())
    expect(again.outcome).toBe('ignored')
  })
})
