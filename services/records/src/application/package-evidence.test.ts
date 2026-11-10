import { describe, expect, it } from 'vitest'
import { buildEvidencePackage } from './package-evidence'

describe('evidence package', () => {
  it('refuses a report when the record is not concluded', async () => {
    const result = await buildEvidencePackage({
      view: {
        id: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
        publicId: 'REG-2026-000001',
        accountId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
        state: 'FALHOU',
        traceId: '11111111-1111-4111-8111-111111111111',
        manifestKey: null,
        manifestHash: null,
        signature: null,
      },
      profile: { fullName: 'Ana', email: 'ana@example.com', cpf: '52998224725' },
      manifestObject: { body: Buffer.from('{}') },
      files: [],
      publicKeyPem: '',
      now: new Date(),
    })
    expect(result).toEqual({ error: 'refused' })
  })
})
