import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib'
import amqp from 'amqplib'
import { catalogEvent, type CatalogEvent } from '@veridt/events'
import type { Manifest } from '@veridt/evidence'
import { Prisma } from '../../generated/client'
import { Config } from './config'
import { ObjectStore } from './object-store'
import { PrismaService } from './prisma.service'

const exchange = 'veridit.events'
const queue = 'records.catalog'

@Injectable()
export class CatalogConsumer implements OnModuleDestroy {
  private connection: ChannelModel | null = null
  private stopped = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: Config,
    private readonly objects: ObjectStore,
  ) {}

  start(): void {
    this.loop().catch(() => undefined)
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true
    await this.connection?.close().catch(() => undefined)
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.consume()
      } catch {
        console.log(JSON.stringify({ msg: 'consumer_retry', service: 'records' }))
      }
      if (!this.stopped) await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  private consume(): Promise<void> {
    return new Promise((resolve, reject) => {
      amqp.connect(this.config.rabbitUrl).then(async (connection) => {
        this.connection = connection
        connection.on('close', () => resolve())
        connection.on('error', () => resolve())
        const channel = await connection.createChannel()
        await channel.assertExchange(exchange, 'topic', { durable: true })
        await channel.assertQueue(queue, { durable: true })
        for (const key of ['RegistroCriado', 'CapturaConcluida', 'CapturaFalhou', 'CapturaCancelada', 'EventoAuditoria']) {
          await channel.bindQueue(queue, exchange, key)
        }
        await channel.prefetch(5)
        await channel.consume(queue, (message) => {
          if (!message) return
          this.handle(channel, message).catch(() => channel.nack(message, false, true))
        })
      }).catch(reject)
    })
  }

  private async handle(channel: Channel, message: ConsumeMessage): Promise<void> {
    const parsed = catalogEvent.safeParse(JSON.parse(message.content.toString('utf8')))
    if (!parsed.success) {
      channel.ack(message)
      return
    }
    const event = parsed.data
    try {
      await this.prisma.processedEvent.create({
        data: { id: event.id, type: event.type, processedAt: new Date() },
      })
    } catch (error) {
      if (isUnique(error)) {
        channel.ack(message)
        return
      }
      throw error
    }
    try {
      await this.apply(event)
      channel.ack(message)
    } catch (error) {
      await this.prisma.processedEvent.delete({ where: { id: event.id } }).catch(() => undefined)
      throw error
    }
  }

  private async apply(event: CatalogEvent): Promise<void> {
    if (event.type === 'RegistroCriado') {
      await this.prisma.recordView.create({
        data: {
          id: event.data.recordId,
          publicId: event.data.publicId,
          accountId: event.data.accountId,
          fullName: event.data.fullName,
          title: event.data.title,
          url: event.data.url,
          captureKind: event.data.captureKind,
          state: event.data.state,
          startedAt: event.data.state === 'EM_ANDAMENTO' ? new Date(event.occurredAt) : null,
          traceId: event.data.traceId,
          createdAt: new Date(event.occurredAt),
        },
      })
      return
    }
    if (event.type === 'EventoAuditoria') {
      await this.prisma.auditEvent.create({
        data: {
          id: event.id,
          action: event.data.action,
          actorId: event.data.actorId,
          recordId: event.data.recordId,
          traceId: event.data.traceId,
          occurredAt: new Date(event.occurredAt),
          detail: event.data.detail as Prisma.InputJsonValue,
        },
      })
      return
    }
    if (event.type === 'CapturaConcluida') {
      const manifestBody = await this.objects.getEvidence(event.data.manifestKey)
      const signature = (await this.objects.getEvidence(`evidence/${event.data.recordId}/manifest.sig`)).toString('utf8')
      const manifest = JSON.parse(manifestBody.toString('utf8')) as Manifest
      await this.prisma.recordView.update({
        where: { id: event.data.recordId },
        data: {
          state: 'CONCLUIDO',
          finishedAt: new Date(event.data.completedAt),
          manifestHash: event.data.manifestHash,
          manifestKey: event.data.manifestKey,
          signature,
          files: manifest.files.map((file) => ({
            name: file.name,
            mediaType: file.mediaType,
            byteSize: file.byteSize,
            sha256: file.sha256,
            storageKey: file.storageKey,
          })),
        },
      })
      return
    }
    await this.prisma.recordView.update({
      where: { id: event.data.recordId },
      data: {
        state: event.type === 'CapturaFalhou' ? 'FALHOU' : 'CANCELADO',
        finishedAt: new Date(event.occurredAt),
      },
    })
  }
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}
