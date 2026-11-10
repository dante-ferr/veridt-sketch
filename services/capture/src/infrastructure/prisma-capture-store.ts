import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { CatalogEvent } from '@veridit/events'
import { Prisma } from '../../generated/client'
import type { CaptureDraft } from '../application/start-capture'
import { CaptureStore } from '../application/start-capture'
import type { StoredCapture } from '../application/accept-executed'
import { PrismaService } from './prisma.service'

@Injectable()
export class PrismaCaptureStore extends CaptureStore {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async nextPublicId(now: Date): Promise<string> {
    const year = now.getUTCFullYear()
    const row = await this.prisma.publicIdSequence.upsert({
      where: { year },
      create: { year, last: 1 },
      update: { last: { increment: 1 } },
    })
    return `REG-${year}-${String(row.last).padStart(6, '0')}`
  }

  async save(draft: CaptureDraft): Promise<void> {
    const state = draft.captureKind === 'screenshot' ? 'NA_FILA' : 'EM_ANDAMENTO'
    await this.prisma.$transaction(async (tx) => {
      await tx.contentRecord.create({
        data: {
          id: draft.id,
          publicId: draft.publicId,
          accountId: draft.accountId,
          fullName: draft.fullName,
          email: draft.email,
          title: draft.title,
          url: draft.url,
          captureKind: draft.captureKind,
          state,
          traceId: draft.traceId,
          startedAt: state === 'EM_ANDAMENTO' ? draft.createdAt : null,
          sessionId: draft.sessionId ?? null,
          createdAt: draft.createdAt,
        },
      })
      for (const event of draft.events) await tx.outbox.create({ data: outbox(event, draft.createdAt) })
      if (draft.captureKind === 'screenshot') {
        await tx.outbox.create({
          data: {
            id: randomUUID(),
            type: 'ScreenshotJob',
            createdAt: draft.createdAt,
            payload: {
              recordId: draft.id,
              publicId: draft.publicId,
              accountId: draft.accountId,
              title: draft.title,
              url: draft.url,
              traceId: draft.traceId,
            },
          },
        })
      }
    })
  }

  async find(id: string): Promise<StoredCapture | null> {
    const row = await this.prisma.contentRecord.findUnique({ where: { id } })
    return row ? toStored(row) : null
  }

  async beginScreenshot(id: string, now: Date): Promise<boolean> {
    const updated = await this.prisma.contentRecord.updateMany({
      where: { id, state: 'NA_FILA' },
      data: { state: 'EM_ANDAMENTO', startedAt: now },
    })
    return updated.count === 1
  }

  async applyWorker(
    commandId: string,
    commandType: string,
    recordId: string,
    patch: {
      state: 'CONCLUIDO' | 'FALHOU'
      reason?: string
      manifestHash?: string
      manifestKey?: string
      signature?: string
      finishedAt?: Date
    },
    events: CatalogEvent[],
    now: Date,
  ): Promise<'applied' | 'duplicate' | 'rejected'> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.processedCommand.create({ data: { id: commandId, type: commandType, processedAt: now } })
        const updated = await tx.contentRecord.updateMany({
          where: { id: recordId, state: { in: ['NA_FILA', 'EM_ANDAMENTO'] } },
          data: {
            state: patch.state,
            failureReason: patch.reason ?? null,
            manifestHash: patch.manifestHash ?? null,
            manifestKey: patch.manifestKey ?? null,
            signature: patch.signature ?? null,
            finishedAt: patch.finishedAt ?? now,
          },
        })
        if (updated.count !== 1) return 'rejected'
        for (const event of events) await tx.outbox.create({ data: outbox(event, now) })
        return 'applied'
      })
    } catch (error) {
      if (isUnique(error)) return 'duplicate'
      throw error
    }
  }

  async cancel(id: string, accountId: string, events: CatalogEvent[], now: Date): Promise<'ok' | 'missing' | 'rejected'> {
    const current = await this.prisma.contentRecord.findFirst({ where: { id, accountId } })
    if (!current) return 'missing'
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.contentRecord.updateMany({
        where: { id, accountId, state: { in: ['NA_FILA', 'EM_ANDAMENTO'] } },
        data: { state: 'CANCELADO', finishedAt: now },
      })
      if (result.count !== 1) return result
      for (const event of events) await tx.outbox.create({ data: outbox(event, now) })
      return result
    })
    return updated.count === 1 ? 'ok' : 'rejected'
  }
}

function toStored(row: {
  id: string
  publicId: string
  accountId: string
  fullName: string
  email: string
  title: string
  state: string
  traceId: string
  manifestHash: string | null
  signature: string | null
}): StoredCapture {
  if (!isState(row.state)) throw new Error('invalid_state')
  return {
    id: row.id,
    publicId: row.publicId,
    accountId: row.accountId,
    fullName: row.fullName,
    email: row.email,
    title: row.title,
    state: row.state,
    traceId: row.traceId,
    manifestHash: row.manifestHash,
    signature: row.signature,
  }
}

function isState(value: string): value is StoredCapture['state'] {
  return value === 'NA_FILA' || value === 'EM_ANDAMENTO' || value === 'CONCLUIDO' || value === 'FALHOU' || value === 'CANCELADO'
}

function outbox(event: CatalogEvent, createdAt: Date): Prisma.OutboxCreateInput {
  return {
    id: event.id,
    type: event.type,
    payload: event as unknown as Prisma.InputJsonValue,
    createdAt,
  }
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}
