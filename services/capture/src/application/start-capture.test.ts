import { describe, expect, it } from 'vitest'
import { BlockedCreditReservation, CreditReservationPort, type CreditReservationRequest, type CreditReservationResult } from './credit-reservation'
import { StartCapture, CaptureStore, VideoSessionPort, type CaptureDraft } from './start-capture'

class MemoryStore extends CaptureStore {
  saved: CaptureDraft[] = []
  async nextPublicId(): Promise<string> {
    return `REG-2026-${String(this.saved.length + 1).padStart(6, '0')}`
  }
  async save(draft: CaptureDraft): Promise<void> {
    this.saved.push(draft)
  }
}

class MemorySessions extends VideoSessionPort {
  calls: string[] = []
  async open(): Promise<{ sessionId: string }> {
    this.calls.push('open')
    return { sessionId: 'session-1' }
  }
  async discard(): Promise<void> {
    this.calls.push('discard')
  }
}

class GrantingCredit extends CreditReservationPort {
  phases: CreditReservationRequest['phase'][] = []
  async reserve(request: CreditReservationRequest): Promise<CreditReservationResult> {
    this.phases.push(request.phase)
    return { outcome: 'reserved', reservationId: `res-${request.recordId}` }
  }
}

const input = {
  accountId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
  fullName: 'Ana Ribeiro',
  email: 'ana@example.com',
  title: 'Página pública',
  url: 'https://example.com/post/1',
  captureKind: 'screenshot' as const,
}

describe('start capture', () => {
  it('blocks a screenshot before any record or queue exists', async () => {
    const store = new MemoryStore()
    const sessions = new MemorySessions()
    const start = new StartCapture(new BlockedCreditReservation(), store, sessions)
    const result = await start.execute(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('credit_reservation_blocked')
    expect(store.saved).toHaveLength(0)
    expect(sessions.calls).toEqual([])
  })

  it('blocks a video after the browser is allocated and stores nothing', async () => {
    const store = new MemoryStore()
    const sessions = new MemorySessions()
    const start = new StartCapture(new BlockedCreditReservation(), store, sessions)
    const result = await start.execute({ ...input, captureKind: 'navigation_video' })
    expect(result.ok).toBe(false)
    expect(sessions.calls).toEqual(['open', 'discard'])
    expect(store.saved).toHaveLength(0)
  })

  it('queues a screenshot only after the credit port reserves it', async () => {
    const store = new MemoryStore()
    const credits = new GrantingCredit()
    const start = new StartCapture(credits, store, new MemorySessions())
    const result = await start.execute(input)
    expect(result.ok).toBe(true)
    expect(credits.phases).toEqual(['before_screenshot_enqueue'])
    expect(store.saved[0]?.captureKind).toBe('screenshot')
    expect(store.saved[0]?.events.map((event) => event.type)).toEqual(['RegistroCriado', 'EventoAuditoria'])
    if (store.saved[0]?.events[0]?.type === 'RegistroCriado') {
      expect(store.saved[0].events[0].data.state).toBe('NA_FILA')
    }
  })

  it('allocates the video browser before asking for the reservation', async () => {
    const sessions = new MemorySessions()
    const credits = new GrantingCredit()
    const store = new MemoryStore()
    const start = new StartCapture(credits, store, sessions)
    const result = await start.execute({ ...input, captureKind: 'navigation_video' })
    expect(result.ok).toBe(true)
    expect(sessions.calls).toEqual(['open'])
    expect(credits.phases).toEqual(['after_video_browser_allocation'])
    if (result.ok) expect(result.value.state).toBe('EM_ANDAMENTO')
  })

  it('rejects a private address before the credit port is called', async () => {
    const credits = new GrantingCredit()
    const start = new StartCapture(credits, new MemoryStore(), new MemorySessions())
    const result = await start.execute({ ...input, url: 'https://127.0.0.1/admin' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('blocked_url')
    expect(credits.phases).toEqual([])
  })
})
