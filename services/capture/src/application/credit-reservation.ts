export type CreditPhase = 'before_screenshot_enqueue' | 'after_video_browser_allocation'

export type CreditReservationRequest = {
  recordId: string
  accountId: string
  captureKind: 'screenshot' | 'navigation_video'
  phase: CreditPhase
}

export const creditsPerRecord = 1

export type CreditBlockReason =
  | 'credit_reservation_pending_adr_003'
  | 'insufficient_credits'
  | 'credits_unavailable'

export type CreditReservationResult =
  | { outcome: 'reserved'; reservationId: string }
  | { outcome: 'blocked'; reason: CreditBlockReason }

export abstract class CreditReservationPort {
  abstract reserve(request: CreditReservationRequest): Promise<CreditReservationResult>
  abstract release(recordId: string): Promise<void>
}

export class BlockedCreditReservation extends CreditReservationPort {
  async reserve(): Promise<CreditReservationResult> {
    return { outcome: 'blocked', reason: 'credit_reservation_pending_adr_003' }
  }

  async release(): Promise<void> {}
}
