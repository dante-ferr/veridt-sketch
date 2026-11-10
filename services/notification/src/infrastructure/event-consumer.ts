import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib'
import amqp from 'amqplib'
import { emailEvent } from '@veridt/events'
import { buildMessage } from '../domain/message'
import { Config } from './config'
import { PrismaService } from './prisma.service'
import { SmtpMailer } from './smtp-mailer'

const exchange = 'veridit.events'
const queue = 'notification.email'
const deadLetter = 'notification.email.dlq'

@Injectable()
export class EventConsumer implements OnModuleDestroy {
  private connection: ChannelModel | null = null
  private stopped = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: SmtpMailer,
    private readonly config: Config,
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
          await channel.assertQueue(deadLetter, { durable: true })
          await channel.assertQueue(queue, {
            durable: true,
            deadLetterExchange: '',
            deadLetterRoutingKey: deadLetter,
          })
          await channel.bindQueue(queue, exchange, 'ConfirmacaoEmailSolicitada')
          await channel.bindQueue(queue, exchange, 'RecuperacaoSenhaSolicitada')
          await channel.bindQueue(queue, exchange, 'CapturaConcluida')
          await channel.bindQueue(queue, exchange, 'PagamentoAprovado')
          await channel.prefetch(5)
          await channel.consume(queue, (message) => {
            if (!message) return
            this.handle(channel, message).catch((error: unknown) => {
              console.log(JSON.stringify({ msg: 'delivery_failed', type: error instanceof Error ? error.name : 'error' }))
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
      console.log(JSON.stringify({ msg: 'event_dropped' }))
      channel.ack(message)
      return
    }
    const parsed = emailEvent.safeParse(parsedJson)
    if (!parsed.success) {
      console.log(JSON.stringify({ msg: 'event_dropped', id: readId(parsedJson) }))
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
      await this.mailer.send(buildMessage(event, this.config.webOrigin))
      channel.ack(message)
      console.log(JSON.stringify({ msg: 'email_sent', id: event.id, type: event.type }))
    } catch (error) {
      await this.prisma.processedEvent.delete({ where: { id: event.id } }).catch(() => undefined)
      const attempts = Number(message.properties.headers?.['x-attempts'] ?? 0)
      if (attempts >= 4) {
        channel.nack(message, false, false)
        return
      }
      channel.ack(message)
      channel.publish(exchange, message.fields.routingKey, message.content, {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        type: event.type,
        headers: { 'x-attempts': attempts + 1 },
      })
      console.log(JSON.stringify({ msg: 'email_retry', id: event.id, type: event.type }))
      if (error instanceof Error) {
        console.log(JSON.stringify({ msg: 'email_retry_cause', type: error.name }))
      }
    }
  }
}

function readId(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return undefined
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
