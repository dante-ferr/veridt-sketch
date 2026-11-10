import { randomUUID } from 'node:crypto'
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { ConfirmChannel, ChannelModel, ConsumeMessage } from 'amqplib'
import amqp from 'amqplib'
import { catalogEvent, workerEvent } from '@veridt/events'
import { z } from 'zod'
import { acceptError, acceptExecuted } from '../application/accept-executed'
import { audit } from '../application/start-capture'
import { Config } from './config'
import { ManifestSigner } from './manifest-signer'
import { PrismaCaptureStore } from './prisma-capture-store'
import { PrismaService } from './prisma.service'
import { S3EvidenceObjects } from './s3-evidence'

const exchange = 'veridit.events'
const job = z.object({
  recordId: z.string().uuid(),
  publicId: z.string().min(1),
  accountId: z.string().uuid(),
  title: z.string(),
  url: z.string(),
  traceId: z.string().uuid(),
})

@Injectable()
export class CaptureBroker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null
  private connection: ChannelModel | null = null
  private channel: ConfirmChannel | null = null
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: Config,
    private readonly store: PrismaCaptureStore,
    private readonly objects: S3EvidenceObjects,
    private readonly signer: ManifestSigner,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.publishPending().catch(() => {
        this.channel = null
        this.connection = null
      })
    }, 1000)
    this.consumeWorkers().catch(() => undefined)
    this.answerBegin().catch(() => undefined)
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.channel?.close().catch(() => undefined)
    await this.connection?.close().catch(() => undefined)
  }

  private async publishPending(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const channel = await this.ensure()
      const rows = await this.prisma.outbox.findMany({ orderBy: { createdAt: 'asc' }, take: 20 })
      for (const row of rows) {
        if (row.type === 'ScreenshotJob') {
          const parsed = job.safeParse(row.payload)
          if (!parsed.success) {
            await this.prisma.outbox.delete({ where: { id: row.id } })
            continue
          }
          channel.sendToQueue('capture.screenshot.jobs', Buffer.from(JSON.stringify(parsed.data)), {
            persistent: true,
            contentType: 'application/json',
            messageId: row.id,
          })
        } else {
          const parsed = catalogEvent.safeParse(row.payload)
          if (!parsed.success) {
            await this.prisma.outbox.delete({ where: { id: row.id } })
            continue
          }
          channel.publish(exchange, parsed.data.type, Buffer.from(JSON.stringify(parsed.data)), {
            persistent: true,
            contentType: 'application/json',
            messageId: parsed.data.id,
            type: parsed.data.type,
          })
        }
        await channel.waitForConfirms()
        await this.prisma.outbox.delete({ where: { id: row.id } })
      }
    } finally {
      this.running = false
    }
  }

  private async consumeWorkers(): Promise<void> {
    const channel = await this.ensure()
    const queue = 'capture.worker'
    await channel.assertQueue(queue, { durable: true })
    await channel.bindQueue(queue, exchange, 'CapturaExecutada')
    await channel.bindQueue(queue, exchange, 'CapturaComErro')
    await channel.consume(queue, (message) => {
      if (!message) return
      this.onWorker(channel, message).catch(() => channel.nack(message, false, true))
    })
  }

  private async onWorker(channel: ConfirmChannel, message: ConsumeMessage): Promise<void> {
    const parsed = workerEvent.safeParse(JSON.parse(message.content.toString('utf8')))
    if (!parsed.success) {
      channel.ack(message)
      return
    }
    const event = parsed.data
    const record = await this.store.find(event.data.recordId)
    if (!record) {
      channel.ack(message)
      return
    }
    const now = new Date()
    if (event.type === 'CapturaComErro') {
      const result = acceptError(record, event.data.reason, now)
      if (result.outcome === 'failed') {
        await this.store.applyWorker(event.id, event.type, record.id, { state: 'FALHOU', reason: result.reason }, result.events, now)
      }
      channel.ack(message)
      return
    }
    const result = await acceptExecuted(
      record,
      { manifestKey: event.data.manifestKey, manifestHash: event.data.manifestHash, finishedAt: event.data.finishedAt },
      this.objects,
      this.signer.privatePem,
      now,
    )
    if (result.outcome === 'concluded') {
      await this.store.applyWorker(
        event.id,
        event.type,
        record.id,
        {
          state: 'CONCLUIDO',
          manifestHash: result.manifestHash,
          manifestKey: event.data.manifestKey,
          signature: result.signature,
          finishedAt: new Date(event.data.finishedAt),
        },
        result.events,
        now,
      )
    } else if (result.outcome === 'failed') {
      await this.store.applyWorker(event.id, event.type, record.id, { state: 'FALHOU', reason: result.reason }, result.events, now)
    }
    channel.ack(message)
  }

  private async answerBegin(): Promise<void> {
    const channel = await this.ensure()
    await channel.assertQueue('capture.screenshot.begin', { durable: true })
    await channel.consume('capture.screenshot.begin', (message) => {
      if (!message) return
      this.onBegin(channel, message).catch(() => channel.ack(message))
    })
  }

  private async onBegin(channel: ConfirmChannel, message: ConsumeMessage): Promise<void> {
    let accepted = false
    try {
      const body = JSON.parse(message.content.toString('utf8')) as { recordId?: string }
      if (body.recordId) accepted = await this.store.beginScreenshot(body.recordId, new Date())
    } catch {
      accepted = false
    }
    if (message.properties.replyTo) {
      channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify({ accepted })), {
        correlationId: message.properties.correlationId,
      })
    }
    channel.ack(message)
  }

  private async ensure(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel
    const connection = await amqp.connect(this.config.rabbitUrl)
    connection.on('close', () => {
      this.channel = null
      this.connection = null
    })
    const channel = await connection.createConfirmChannel()
    await channel.assertExchange(exchange, 'topic', { durable: true })
    await channel.assertQueue('capture.screenshot.jobs', { durable: true })
    this.connection = connection
    this.channel = channel
    return channel
  }
}

export function cancelEvents(record: { id: string; publicId: string; accountId: string; traceId: string }, now: Date) {
  return [
    {
      type: 'CapturaCancelada' as const,
      version: 1 as const,
      id: randomUUID(),
      occurredAt: now.toISOString(),
      data: {
        recordId: record.id,
        publicId: record.publicId,
        accountId: record.accountId,
        state: 'CANCELADO' as const,
        traceId: record.traceId,
      },
    },
    audit(now, 'capture_cancelled', record.accountId, record.id, record.traceId, {}),
  ]
}
