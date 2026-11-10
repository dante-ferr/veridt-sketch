import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  beginScreenshot,
  canPackageEvidence,
  canonicalJson,
  cancelCapture,
  clockNeedsAlert,
  concludeCapture,
  failCapture,
  hashesMatchStored,
  initialState,
  isPublicHttpUrl,
  isPublicIp,
  manifestHash,
  sha256Hex,
  signManifest,
  verifyManifest,
  type Manifest,
} from './index'

function keys(): { privatePem: string; publicPem: string } {
  const pair = generateKeyPairSync('ed25519')
  return {
    privatePem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
}

function sample(): Manifest {
  const png = Buffer.from('png-bytes')
  return {
    recordId: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
    publicId: 'REG-2026-000417',
    accountId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
    url: 'https://example.com/post/1',
    title: 'Publicação',
    startedAt: '2026-11-08T18:00:00.000Z',
    finishedAt: '2026-11-08T18:00:02.000Z',
    files: [
      {
        name: 'capture.png',
        mediaType: 'image/png',
        byteSize: png.length,
        sha256: sha256Hex(png),
        storageKey: 'evidence/record/capture.png',
      },
    ],
    metadata: {
      siteAddress: '93.184.216.34',
      dnsAnswers: ['93.184.216.34'],
      tls: {
        subject: 'example.com',
        issuer: 'Example CA',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2027-01-01T00:00:00.000Z',
        protocol: 'TLSv1.3',
      },
      httpStatus: 200,
      httpHeaders: { 'content-type': 'text/html' },
      pageHtmlSha256: sha256Hex(Buffer.from('<html></html>')),
      browserVersion: 'Chromium 130',
      clockOffsetMs: 12,
    },
  }
}

describe('manifest integrity', () => {
  it('gives every completed file a hash and signs the canonical manifest', () => {
    const manifest = sample()
    expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true)
    const canonical = canonicalJson(manifest)
    const opened = keys()
    const signed = signManifest(canonical, opened.privatePem)
    expect(verifyManifest(canonical, signed, opened.publicPem)).toBe(true)
    expect(manifestHash(manifest)).toBe(sha256Hex(Buffer.from(canonical, 'utf8')))
  })

  it('detects a one-byte change in a file or in the manifest', () => {
    const opened = keys()
    const manifest = sample()
    const canonical = canonicalJson(manifest)
    const signature = signManifest(canonical, opened.privatePem)
    const file = Buffer.from('png-bytes')
    const flipped = Buffer.from(file)
    flipped[0] = flipped[0] ^ 0xff
    expect(sha256Hex(flipped)).not.toBe(manifest.files[0]?.sha256)

    const tamperedFile = structuredClone(manifest)
    tamperedFile.files[0]!.sha256 = sha256Hex(flipped)
    expect(verifyManifest(canonicalJson(tamperedFile), signature, opened.publicPem)).toBe(false)

    const tamperedBytes = Buffer.from(canonical, 'utf8')
    tamperedBytes[10] = tamperedBytes[10] ^ 0xff
    expect(sha256Hex(tamperedBytes)).not.toBe(sha256Hex(Buffer.from(canonical, 'utf8')))
    expect(verifyManifest(tamperedBytes.toString('utf8'), signature, opened.publicPem)).toBe(false)
    expect(hashesMatchStored(manifest, { 'evidence/record/capture.png': sha256Hex(flipped) })).toBe(false)
    expect(hashesMatchStored(manifest, { 'evidence/record/capture.png': manifest.files[0]!.sha256 })).toBe(true)
  })
})

describe('record state', () => {
  it('queues only screenshots and refuses a second start', () => {
    expect(initialState('screenshot')).toBe('NA_FILA')
    expect(initialState('navigation_video')).toBe('EM_ANDAMENTO')
    expect(beginScreenshot('NA_FILA')).toBe('EM_ANDAMENTO')
    expect(beginScreenshot('EM_ANDAMENTO')).toBe('rejected')
    expect(beginScreenshot('FALHOU')).toBe('rejected')
    expect(beginScreenshot('CANCELADO')).toBe('rejected')
  })

  it('fails or cancels once, and packages only a concluded record', () => {
    expect(failCapture('EM_ANDAMENTO')).toBe('FALHOU')
    expect(failCapture('FALHOU')).toBe('rejected')
    expect(cancelCapture('NA_FILA')).toBe('CANCELADO')
    expect(cancelCapture('CONCLUIDO')).toBe('rejected')
    expect(concludeCapture('EM_ANDAMENTO')).toBe('CONCLUIDO')
    expect(concludeCapture('NA_FILA')).toBe('rejected')
    expect(canPackageEvidence('CONCLUIDO')).toBe(true)
    expect(canPackageEvidence('FALHOU')).toBe(false)
    expect(canPackageEvidence('EM_ANDAMENTO')).toBe(false)
  })
})

describe('capture target', () => {
  it('rejects loopback, private, and link-local targets', () => {
    expect(isPublicHttpUrl('https://example.com/a')).toBe(true)
    expect(isPublicHttpUrl('http://127.0.0.1/admin')).toBe(false)
    expect(isPublicHttpUrl('https://10.1.1.1/a')).toBe(false)
    expect(isPublicHttpUrl('https://192.168.0.8/a')).toBe(false)
    expect(isPublicHttpUrl('https://169.254.169.254/latest')).toBe(false)
    expect(isPublicHttpUrl('https://localhost/a')).toBe(false)
    expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isPublicIp('8.8.8.8')).toBe(true)
    expect(isPublicIp('172.16.0.1')).toBe(false)
  })

  it('alerts when the worker clock is a second or more from NTP, or NTP is missing', () => {
    expect(clockNeedsAlert(999)).toBe(false)
    expect(clockNeedsAlert(1000)).toBe(true)
    expect(clockNeedsAlert(-1500)).toBe(true)
    expect(clockNeedsAlert(null)).toBe(true)
  })
})
