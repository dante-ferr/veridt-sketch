import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { AuditAction, CatalogEvent } from '@veridt/events'
import type { CaptureKind } from '@veridt/evidence'
import { initialState, isPublicHttpUrl } from '@veridt/evidence'
import { creditsPerRecord, CreditReservationPort, type CreditBlockReason } from './credit-reservation'
import type { Result } from './result'
import { fail, ok } from './result'

export type CaptureDraft = {
  id: string
  publicId: string
  accountId: string
  fullName: string
  email: string
  title: string
  url: string
  captureKind: CaptureKind
  traceId: string
  createdAt: Date
  events: CatalogEvent[]
  sessionId?: string
}

export abstract class CaptureStore {
  abstract nextPublicId(now: Date): Promise<string>
  abstract save(draft: CaptureDraft): Promise<void>
}

export type OpenedSession = { sessionId: string }

export abstract class VideoSessionPort {
  abstract open(input: {
    recordId: string
    accountId: string
    url: string
    title: string
    traceId: string
  }): Promise<OpenedSession>
  abstract discard(sessionId: string): Promise<void>
}

export type StartInput = {
  accountId: string
  fullName: string
  email: string
  title: string
  url: string
  captureKind: CaptureKind
}

export type StartedCapture = {
  id: string
  publicId: string
  state: string
  sessionId: string | null
}

@Injectable()
export class StartCapture {
  constructor(
    private readonly credits: CreditReservationPort,
    private readonly store: CaptureStore,
    private readonly sessions: VideoSessionPort,
  ) {}

  private readonly now = (): Date => new Date()
  private readonly newId = (): string => randomUUID()

  async execute(input: StartInput): Promise<Result<StartedCapture>> {
    const title = input.title.trim()
    if (title.length < 1 || title.length > 120) return fail('invalid_title', 'Enter a title.', 400)
    if (!isPublicHttpUrl(input.url)) return fail('blocked_url', 'Use a public http or https address.', 400)
    const id = this.newId()
    const traceId = this.newId()
    if (input.captureKind === 'navigation_video') return this.startVideo(input, id, traceId, title)
    return this.startScreenshot(input, id, traceId, title)
  }

  private async startScreenshot(input: StartInput, id: string, traceId: string, title: string): Promise<Result<StartedCapture>> {
    const reservation = await this.credits.reserve({
      recordId: id,
      accountId: input.accountId,
      captureKind: 'screenshot',
      phase: 'before_screenshot_enqueue',
    })
    if (reservation.outcome === 'blocked') return blocked(reservation.reason)
    const now = this.now()
    const publicId = await this.store.nextPublicId(now)
    try {
      await this.store.save({
      ...this.base(input, id, publicId, traceId, title, now),
      events: [
        recordCreated(now, {
          recordId: id,
          publicId,
          accountId: input.accountId,
          fullName: input.fullName,
          title,
          url: input.url,
          captureKind: 'screenshot',
          state: 'NA_FILA',
          traceId,
        }),
        audit(now, 'capture_started', input.accountId, id, traceId, {
          captureKind: 'screenshot',
          phase: 'before_screenshot_enqueue',
        }),
      ],
    })
    } catch (error) {
      await this.credits.release(id)
      throw error
    }
    return ok({ id, publicId, state: initialState('screenshot'), sessionId: null })
  }

  private async startVideo(input: StartInput, id: string, traceId: string, title: string): Promise<Result<StartedCapture>> {
    const now = this.now()
    const session = await this.sessions.open({
      recordId: id,
      accountId: input.accountId,
      url: input.url,
      title,
      traceId,
    })
    const reservation = await this.credits.reserve({
      recordId: id,
      accountId: input.accountId,
      captureKind: 'navigation_video',
      phase: 'after_video_browser_allocation',
    })
    if (reservation.outcome === 'blocked') {
      await this.sessions.discard(session.sessionId)
      return blocked(reservation.reason)
    }
    const publicId = await this.store.nextPublicId(now)
    try {
      await this.store.save({
      ...this.base(input, id, publicId, traceId, title, now),
      sessionId: session.sessionId,
      events: [
        recordCreated(now, {
          recordId: id,
          publicId,
          accountId: input.accountId,
          fullName: input.fullName,
          title,
          url: input.url,
          captureKind: 'navigation_video',
          state: 'EM_ANDAMENTO',
          traceId,
        }),
        audit(now, 'capture_started', input.accountId, id, traceId, {
          captureKind: 'navigation_video',
          phase: 'after_video_browser_allocation',
        }),
      ],
    })
    } catch (error) {
      await this.sessions.discard(session.sessionId)
      await this.credits.release(id)
      throw error
    }
    return ok({ id, publicId, state: initialState('navigation_video'), sessionId: session.sessionId })
  }

  private base(input: StartInput, id: string, publicId: string, traceId: string, title: string, now: Date): CaptureDraft {
    return {
      id,
      publicId,
      accountId: input.accountId,
      fullName: input.fullName,
      email: input.email,
      title,
      url: input.url,
      captureKind: input.captureKind,
      traceId,
      createdAt: now,
      events: [],
    }
  }
}

function blocked(reason: CreditBlockReason): Result<never> {
  if (reason === 'insufficient_credits') {
    return fail(
      'insufficient_credits',
      `This record needs ${creditsPerRecord} credit. Buy credits or settle a negative balance.`,
      409,
    )
  }
  if (reason === 'credits_unavailable') {
    return fail('credits_unavailable', 'The credits service is unavailable. The capture did not start.', 503)
  }
  return fail(
    'credit_reservation_blocked',
    'Credit reservation is blocked until ADR-003. The capture did not start.',
    409,
  )
}

function recordCreated(now: Date, data: Extract<CatalogEvent, { type: 'RegistroCriado' }>['data']): CatalogEvent {
  return { type: 'RegistroCriado', version: 1, id: randomUUID(), occurredAt: now.toISOString(), data }
}

export function audit(
  now: Date,
  action: AuditAction,
  actorId: string,
  recordId: string | null,
  traceId: string,
  detail: Record<string, string>,
): CatalogEvent {
  return {
    type: 'EventoAuditoria',
    version: 1,
    id: randomUUID(),
    occurredAt: now.toISOString(),
    data: { action, actorId, recordId, traceId, detail },
  }
}
