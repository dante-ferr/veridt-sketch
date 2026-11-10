import { describe, expect, it } from 'vitest'
import { sha256Hex, type Manifest } from '@veridit/evidence'
import { buildReport, packageDecision } from './report'

const manifest: Manifest = {
  recordId: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
  publicId: 'REG-2026-000001',
  accountId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
  url: 'https://example.com/post/1',
  title: 'Página',
  startedAt: '2026-11-08T18:00:00.000Z',
  finishedAt: '2026-11-08T18:00:03.000Z',
  files: [
    {
      name: 'capture.png',
      mediaType: 'image/png',
      byteSize: 9,
      sha256: sha256Hex(Buffer.from('png-bytes')),
      storageKey: 'evidence/x/capture.png',
    },
  ],
  metadata: {
    siteAddress: '93.184.216.34',
    dnsAnswers: ['93.184.216.34'],
    tls: null,
    httpStatus: 200,
    httpHeaders: {},
    pageHtmlSha256: sha256Hex(Buffer.from('html')),
    browserVersion: 'Chromium test',
    clockOffsetMs: 0,
  },
}

describe('evidence report', () => {
  it('carries the manifest hash, the signature, and the file hashes', () => {
    const report = buildReport({
      reportId: '22222222-2222-4222-8222-222222222222',
      manifest,
      profile: { fullName: 'Ana Ribeiro', email: 'ana@example.com', cpf: '52998224725' },
      manifestHash: 'a'.repeat(64),
      signature: 'c2ln',
    })
    expect(report.manifestHash).toBe('a'.repeat(64))
    expect(report.signature).toBe('c2ln')
    expect(report.files[0]?.sha256).toBe(manifest.files[0]?.sha256)
    expect(report.cpf).toBe('52998224725')
    expect(report.durationMs).toBe(3000)
    expect(report.site).toBe('example.com')
  })

  it('refuses a report for a record that is not CONCLUIDO', () => {
    expect(packageDecision('CONCLUIDO')).toBe('allowed')
    expect(packageDecision('NA_FILA')).toBe('refused')
    expect(packageDecision('EM_ANDAMENTO')).toBe('refused')
    expect(packageDecision('FALHOU')).toBe('refused')
    expect(packageDecision('CANCELADO')).toBe('refused')
  })
})
