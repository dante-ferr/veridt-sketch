import { randomUUID } from 'node:crypto'
import type { ChargeStatus } from '../domain/books'

type CreatedCharge = {
  providerPaymentId: string
  status: ChargeStatus
  pixCopyPaste: string
  checkoutUrl: string
}

export class MercadoPagoProvider {
  constructor(private readonly token: string) {}

  async createPix(input: {
    orderId: string
    amountCents: number
    description: string
    email: string
  }): Promise<CreatedCharge> {
    const body = await this.post('/v1/payments', {
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: 'pix',
      external_reference: input.orderId,
      payer: { email: input.email },
    })
    const data = body.point_of_interaction as { transaction_data?: { qr_code?: string } } | undefined
    return {
      providerPaymentId: String(body.id),
      status: mapStatus(String(body.status ?? 'pending')),
      pixCopyPaste: data?.transaction_data?.qr_code ?? '',
      checkoutUrl: '',
    }
  }

  async createCheckout(input: {
    orderId: string
    title: string
    amountCents: number
    email: string
    backUrl: string
  }): Promise<CreatedCharge> {
    const body = await this.post('/checkout/preferences', {
      items: [{ title: input.title, quantity: 1, unit_price: input.amountCents / 100, currency_id: 'BRL' }],
      external_reference: input.orderId,
      payer: { email: input.email },
      back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
    })
    return {
      providerPaymentId: String(body.id),
      status: 'pending',
      pixCopyPaste: '',
      checkoutUrl: String(body.init_point ?? body.sandbox_init_point ?? ''),
    }
  }

  async query(paymentId: string): Promise<{ status: ChargeStatus; externalReference: string }> {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('provider_unavailable')
    const body = (await response.json()) as { status?: string; external_reference?: string }
    return { status: mapStatus(String(body.status ?? 'pending')), externalReference: String(body.external_reference ?? '') }
  }

  private async post(path: string, payload: unknown): Promise<Record<string, unknown>> {
    if (!this.token) throw new Error('provider_unavailable')
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('provider_unavailable')
    return (await response.json()) as Record<string, unknown>
  }
}

function mapStatus(status: string): ChargeStatus {
  if (status === 'approved') return 'approved'
  if (status === 'refunded' || status === 'charged_back') return 'refunded'
  if (status === 'cancelled' || status === 'rejected') return 'rejected'
  if (status === 'expired') return 'expired'
  return 'pending'
}
