import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { ConfirmChannel, ChannelModel } from 'amqplib'
import amqp from 'amqplib'
import { creditReturned, paymentApproved } from '@veridt/events'
import { Config } from './config'
import { PrismaService } from './prisma.service'

const exchange = 'veridit.events'

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null
  private connection: ChannelModel | null = null
  private channel: ConfirmChannel | null = null
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: Config,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.publishPending().catch((error: unknown) => {
        this.channel = null
        this.connection = null
        console.log(JSON.stringify({ msg: 'outbox_failed', type: error instanceof Error ? error.name : 'error' }))
      })
    }, 1000)
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
      const channel = await this.ensureChannel()
      const rows = await this.prisma.outbox.findMany({ orderBy: { createdAt: 'asc' }, take: 20 })
      for (const row of rows) {
        const payload = row.payload
        const approved = paymentApproved.safeParse(payload)
        const returned = creditReturned.safeParse(payload)
        const event = approved.success ? approved.data : returned.success ? returned.data : null
        if (!event) {
          console.log(JSON.stringify({ msg: 'outbox_dropped', id: row.id }))
          await this.prisma.outbox.delete({ where: { id: row.id } })
          continue
        }
        channel.publish(exchange, event.type, Buffer.from(JSON.stringify(event)), {
          persistent: true,
          contentType: 'application/json',
          messageId: event.id,
          type: event.type,
        })
        await channel.waitForConfirms()
        await this.prisma.outbox.delete({ where: { id: row.id } })
        console.log(JSON.stringify({ msg: 'event_published', id: event.id, type: event.type }))
      }
    } finally {
      this.running = false
    }
  }

  private async ensureChannel(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel
    const connection = await amqp.connect(this.config.rabbitUrl)
    connection.on('close', () => {
      this.channel = null
      this.connection = null
    })
    const channel = await connection.createConfirmChannel()
    await channel.assertExchange(exchange, 'topic', { durable: true })
    this.connection = connection
    this.channel = channel
    return channel
  }
}
