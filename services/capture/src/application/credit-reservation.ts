export type CreditPhase = 'before_screenshot_enqueue' | 'after_video_browser_allocation'

export type CreditReservationRequest = {
  recordId: string
  accountId: string
  captureKind: 'screenshot' | 'navigation_video'
  phase: CreditPhase
}

export type CreditReservationResult =
  | { outcome: 'reserved'; reservationId: string }
  | { outcome: 'blocked'; reason: 'credit_reservation_pending_adr_003' }

export abstract class CreditReservationPort {
  abstract reserve(request: CreditReservationRequest): Promise<CreditReservationResult>
}

export class BlockedCreditReservation extends CreditReservationPort {
  async reserve(): Promise<CreditReservationResult> {
    return { outcome: 'blocked', reason: 'credit_reservation_pending_adr_003' }
  }
}
