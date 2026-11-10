import { createHash, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { Config } from './config'
import { VideoSessionPort, type OpenedSession } from '../application/start-capture'

@Injectable()
export class IdentityDirectory {
  constructor(private readonly config: Config) {}

  contact(accountId: string): Promise<{ fullName: string; email: string } | null> {
    return this.get(accountId, 'contact')
  }

  private async get(accountId: string, kind: 'contact'): Promise<{ fullName: string; email: string } | null> {
    const response = await fetch(`${this.config.identityUrl}/v1/internal/accounts/${accountId}/${kind}`, {
      headers: { 'x-service-token': this.config.serviceToken },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error('identity_unavailable')
    return (await response.json()) as { fullName: string; email: string }
  }
}

@Injectable()
export class WorkerVideoSessions extends VideoSessionPort {
  constructor(private readonly config: Config) {
    super()
  }

  async open(input: {
    recordId: string
    accountId: string
    url: string
    title: string
    traceId: string
  }): Promise<OpenedSession> {
    const response = await fetch(`${this.config.workerUrl}/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': this.config.internalToken,
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error('worker_unavailable')
    const body = (await response.json()) as { sessionId: string }
    return { sessionId: body.sessionId }
  }

  async discard(sessionId: string): Promise<void> {
    await fetch(`${this.config.workerUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'x-internal-token': this.config.internalToken },
    }).catch(() => undefined)
  }

  async conclude(sessionId: string, publicId: string): Promise<boolean> {
    const response = await fetch(`${this.config.workerUrl}/sessions/${sessionId}/conclude`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': this.config.internalToken,
      },
      body: JSON.stringify({ publicId }),
    })
    return response.ok
  }
}

export function sameSecret(provided: string | undefined, expected: string): boolean {
  const left = createHash('sha256').update(provided ?? '').digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right) && Boolean(provided)
}
