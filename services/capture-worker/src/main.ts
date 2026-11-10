import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { ConfirmChannel, ChannelModel, ConsumeMessage } from 'amqplib'
import amqp from 'amqplib'
import { z } from 'zod'
import { WebSocketServer } from 'ws'
import { runScreenshot, type ScreenshotJob } from './application/run-screenshot'
import { observeWithChromium } from './infrastructure/browser'
import { queryNtp } from './infrastructure/ntp-query'
import { SessionHub } from './infrastructure/sessions'
import { evidenceClient, putImmutable } from './infrastructure/storage'

const exchange = 'veridit.events'
const rabbitUrl = required('RABBIT_URL')
const captureUrl = required('CAPTURE_URL')
const internalToken = required('CAPTURE_INTERNAL_TOKEN')
const ntpHost = process.env.NTP_HOST ?? 'pool.ntp.org'
const s3 = {
  endpoint: required('S3_ENDPOINT'),
  accessKey: required('S3_ACCESS_KEY'),
  secretKey: required('S3_SECRET_KEY'),
  bucket: process.env.S3_BUCKET ?? 'evidence',
  region: process.env.S3_REGION ?? 'us-east-1',
}
const client = evidenceClient(s3)
const port = Number(process.env.PORT ?? '3010')

const jobSchema = z.object({
  recordId: z.string().uuid(),
  publicId: z.string().min(1),
  accountId: z.string().uuid(),
  title: z.string(),
  url: z.string(),
  traceId: z.string().uuid(),
})

async function main(): Promise<void> {
  const connection = await connect()
  const channel = await connection.createConfirmChannel()
  await channel.assertExchange(exchange, 'topic', { durable: true })
  await channel.assertQueue('capture.screenshot.jobs', { durable: true })
  const publish = async (event: { type: string; id: string } & Record<string, unknown>): Promise<void> => {
    channel.publish(exchange, event.type, Buffer.from(JSON.stringify(event)), {
      persistent: true,
      contentType: 'application/json',
      messageId: event.id,
      type: event.type,
    })
    await channel.waitForConfirms()
  }
  const hub = new SessionHub(
    publish,
    async (detail, input) => {
      await publish({
        type: 'EventoAuditoria',
        version: 1,
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        data: {
          action: 'navigation_input',
          actorId: input.accountId,
          recordId: input.recordId,
          traceId: input.traceId,
          detail,
        },
      })
    },
    (object) => putImmutable(client, s3.bucket, object),
    () => queryNtp(ntpHost),
  )
  const server = createServer((request, response) => {
    handleHttp(request, response, hub).catch(() => {
      response.writeHead(500)
      response.end()
    })
  })
  const sockets = new WebSocketServer({ noServer: true })
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://worker')
    const match = /^\/sessions\/([0-9a-f-]{36})$/.exec(url.pathname)
    if (!match) {
      socket.destroy()
      return
    }
    const id = match[1] ?? ''
    sockets.handleUpgrade(request, socket, head, (ws) => {
      hub.attach(id, url.searchParams.get('accountId') ?? '', ws)
    })
  })
  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve))
  await channel.prefetch(1)
  await channel.consume('capture.screenshot.jobs', (message) => {
    if (!message) return
    handleJob(channel, message, publish).catch(() => channel.ack(message))
  })
  console.log(JSON.stringify({ msg: 'service_ready', service: 'capture-worker', port }))
}

async function handleJob(
  channel: ConfirmChannel,
  message: ConsumeMessage,
  publish: (event: { type: string; id: string }) => Promise<void>,
): Promise<void> {
  const parsed = jobSchema.safeParse(JSON.parse(message.content.toString('utf8')))
  if (!parsed.success) {
    channel.ack(message)
    return
  }
  await runScreenshot(parsed.data satisfies ScreenshotJob, {
    begin: (recordId) => askBegin(channel, recordId),
    observe: observeWithChromium,
    putImmutable: (object) => putImmutable(client, s3.bucket, object),
    publish,
    clockOffsetMs: () => queryNtp(ntpHost),
    now: () => new Date(),
  })
  channel.ack(message)
}

function askBegin(channel: ConfirmChannel, recordId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const correlationId = randomUUID()
    const timer = setTimeout(() => resolve(false), 5000)
    channel.assertQueue('', { exclusive: true }).then((queue) => {
      channel.consume(queue.queue, (message) => {
        if (!message || message.properties.correlationId !== correlationId) return
        clearTimeout(timer)
        channel.ack(message)
        const body = JSON.parse(message.content.toString('utf8')) as { accepted?: boolean }
        resolve(body.accepted === true)
      }).then(() => {
        channel.sendToQueue('capture.screenshot.begin', Buffer.from(JSON.stringify({ recordId })), {
          replyTo: queue.queue,
          correlationId,
        })
      }).catch(() => resolve(false))
    }).catch(() => resolve(false))
  })
}

async function handleHttp(request: IncomingMessage, response: ServerResponse, hub: SessionHub): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://worker')
  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok' }))
    return
  }
  if (!sameSecret(header(request, 'x-internal-token'), internalToken)) {
    response.writeHead(401)
    response.end()
    return
  }
  if (request.method === 'POST' && url.pathname === '/sessions') {
    const body = JSON.parse(await readBody(request)) as SessionBody
    const sessionId = await hub.open(body)
    response.writeHead(201, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ sessionId }))
    return
  }
  const sessionMatch = /^\/sessions\/([0-9a-f-]{36})(\/conclude)?$/.exec(url.pathname)
  if (!sessionMatch) {
    response.writeHead(404)
    response.end()
    return
  }
  const id = sessionMatch[1] ?? ''
  if (request.method === 'DELETE') {
    await hub.discard(id)
    response.writeHead(204)
    response.end()
    return
  }
  if (request.method === 'POST' && sessionMatch[2] === '/conclude') {
    const body = JSON.parse(await readBody(request)) as { publicId?: string }
    if (!body.publicId) {
      response.writeHead(400)
      response.end()
      return
    }
    await hub.conclude(id, body.publicId)
    response.writeHead(202)
    response.end()
    return
  }
  response.writeHead(404)
  response.end()
}

type SessionBody = {
  recordId: string
  accountId: string
  url: string
  title: string
  traceId: string
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function sameSecret(provided: string | undefined, expected: string): boolean {
  const left = createHash('sha256').update(provided ?? '').digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right) && Boolean(provided)
}

async function connect(): Promise<ChannelModel> {
  for (;;) {
    try {
      return await amqp.connect(rabbitUrl)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(JSON.stringify({ msg: 'missing_config', key: name }))
    process.exit(1)
  }
  return value
}

void captureUrl
main().catch((error: unknown) => {
  console.log(JSON.stringify({ msg: 'worker_failed', type: error instanceof Error ? error.name : 'error' }))
  process.exit(1)
})
