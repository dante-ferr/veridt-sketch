import { Injectable } from '@nestjs/common'
import {
  creditsPerRecord,
  CreditReservationPort,
  type CreditReservationRequest,
  type CreditReservationResult,
} from '../application/credit-reservation'
import { Config } from './config'

@Injectable()
export class HttpCreditReservation extends CreditReservationPort {
  constructor(private readonly config: Config) {
    super()
  }

  async reserve(request: CreditReservationRequest): Promise<CreditReservationResult> {
    try {
      const response = await fetch(`${this.config.paymentsUrl}/v1/internal/reservations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-service-token': this.config.paymentsServiceToken,
        },
        body: JSON.stringify({
          recordId: request.recordId,
          accountId: request.accountId,
          credits: creditsPerRecord,
        }),
        signal: AbortSignal.timeout(3000),
      })
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        if (body?.error === 'insufficient_credits') return { outcome: 'blocked', reason: 'insufficient_credits' }
        return { outcome: 'blocked', reason: 'credits_unavailable' }
      }
      if (!response.ok) return { outcome: 'blocked', reason: 'credits_unavailable' }
      const body = (await response.json()) as { reservationId: string }
      return { outcome: 'reserved', reservationId: body.reservationId }
    } catch {
      return { outcome: 'blocked', reason: 'credits_unavailable' }
    }
  }

  async release(recordId: string): Promise<void> {
    await fetch(`${this.config.paymentsUrl}/v1/internal/reservation-returns`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': this.config.paymentsServiceToken,
      },
      body: JSON.stringify({ recordId }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined)
  }
}
