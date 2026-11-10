import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib'
import amqp from 'amqplib'
import { captureCancelled, captureCompleted, captureFailed } from '@veridt/events'
import { z } from 'zod'
import { Config } from './config'
import { PaymentsService } from './payments.service'

const exchange = 'veridit.events'
const queue = 'payments.captures'
const notice = z.discriminatedUnion('type', [captureCompleted, captureFailed, captureCancelled])

@Injectable()
export class EventConsumer implements OnModuleDestroy {
  private connection: ChannelModel | null = null
  private stopped = false

  constructor(
    private readonly config: Config,
    private readonly payments: PaymentsService,
  ) {}

  start(): void {
    this.loop().catch((error: unknown) => {
      console.log(JSON.stringify({ msg: 'consumer_stopped', type: error instanceof Error ? error.name : 'error' }))
    })
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true
    await this.connection?.close().catch(() => undefined)
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.consume()
      } catch (error) {
        console.log(JSON.stringify({ msg: 'consumer_retry', type: error instanceof Error ? error.name : 'error' }))
      }
      if (!this.stopped) await delay(1000)
    }
  }

  private consume(): Promise<void> {
    return new Promise((resolve, reject) => {
      amqp
        .connect(this.config.rabbitUrl)
        .then(async (connection) => {
          this.connection = connection
          connection.on('close', () => resolve())
          connection.on('error', () => resolve())
          const channel = await connection.createChannel()
          await channel.assertExchange(exchange, 'topic', { durable: true })
          await channel.assertQueue(queue, { durable: true })
          await channel.bindQueue(queue, exchange, 'CapturaConcluida')
          await channel.bindQueue(queue, exchange, 'CapturaFalhou')
          await channel.bindQueue(queue, exchange, 'CapturaCancelada')
          await channel.prefetch(5)
          await channel.consume(queue, (message) => {
            if (!message) return
            this.handle(channel, message).catch((error: unknown) => {
              console.log(JSON.stringify({ msg: 'delivery_failed', type: error instanceof Error ? error.name : 'error' }))
              channel.nack(message, false, true)
            })
          })
        })
        .catch(reject)
    })
  }

  private async handle(channel: Channel, message: ConsumeMessage): Promise<void> {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(message.content.toString('utf8'))
    } catch {
      channel.ack(message)
      return
    }
    const parsed = notice.safeParse(parsedJson)
    if (!parsed.success) {
      channel.ack(message)
      return
    }
    await this.payments.onCapture(parsed.data.type, parsed.data.data.recordId)
    channel.ack(message)
    console.log(JSON.stringify({ msg: 'capture_credit_applied', id: parsed.data.id, type: parsed.data.type }))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
