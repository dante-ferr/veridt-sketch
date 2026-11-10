import { describe, expect, it } from 'vitest'
import type { EmailEvent } from '@veridt/events'
import { buildMessage } from './message'

describe('completion email', () => {
  it('includes the manifest hash', () => {
    const hash = 'ab'.repeat(32)
    const event: EmailEvent = {
      type: 'CapturaConcluida',
      version: 1,
      id: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
      occurredAt: '2026-11-08T18:00:00.000Z',
      data: {
        recordId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
        publicId: 'REG-2026-000001',
        accountId: '11111111-1111-4111-8111-111111111111',
        fullName: 'Ana Ribeiro',
        email: 'ana@example.com',
        title: 'Página',
        manifestHash: hash,
        manifestKey: 'evidence/record/manifest.json',
        completedAt: '2026-11-08T18:00:02.000Z',
      },
    }
    const message = buildMessage(event, 'https://localhost:8443')
    expect(message.subject).toBe('Captura concluída no Veridt')
    expect(message.text).toContain(`Hash do manifesto (SHA-256): ${hash}`)
  })

  it('confirms an approved payment', () => {
    const event: EmailEvent = {
      type: 'PagamentoAprovado',
      version: 1,
      id: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
      occurredAt: '2026-11-10T12:00:00.000Z',
      data: {
        orderId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
        accountId: '11111111-1111-4111-8111-111111111111',
        fullName: 'Ana Ribeiro',
        email: 'ana@example.com',
        packageName: 'Médio',
        creditCount: 30,
        totalCents: 12000,
      },
    }
    const message = buildMessage(event, 'https://localhost:8443')
    expect(message.subject).toBe('Pagamento confirmado no Veridt')
    expect(message.text).toContain('30 créditos entraram no saldo.')
    expect(message.to).toBe('ana@example.com')
  })
})
