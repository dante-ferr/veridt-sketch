import { describe, expect, it } from 'vitest'
import { canonicalJson, signatureMatches, signRaw } from './signature'

describe('webhook signature', () => {
  it('accepts the raw body signed with the shared secret and rejects a different body', () => {
    const raw = canonicalJson({ providerPaymentId: 'pay-1', hint: 'approved' })
    const signature = signRaw('webhook-secret', raw)
    expect(signatureMatches('webhook-secret', raw, signature)).toBe(true)
    expect(signatureMatches('webhook-secret', canonicalJson({ providerPaymentId: 'pay-2' }), signature)).toBe(false)
    expect(signatureMatches('other-secret', raw, signature)).toBe(false)
    expect(signatureMatches('webhook-secret', raw, undefined)).toBe(false)
  })
})
