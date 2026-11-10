import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { lookup } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import type { WorkerEvent } from '@veridit/events'
import {
  VIDEO_SESSION_LIMIT_MS,
  canonicalJson,
  isPublicHttpUrl,
  isPublicIp,
  manifestHash,
  sha256Hex,
  type Manifest,
  type ManifestFile,
} from '@veridit/evidence'
import type { Browser, BrowserContext, Page } from 'playwright'
import type { WebSocket } from 'ws'
import type { ObjectPut } from '../application/run-screenshot'

export type SessionOpen = {
  recordId: string
  accountId: string
  url: string
  title: string
  traceId: string
}

type Shot = { name: string; bytes: Buffer; htmlName: string; html: Buffer }

type LiveSession = {
  id: string
  input: SessionOpen
  startedAt: Date
  browser: Browser
  context: BrowserContext
  page: Page
  shots: Shot[]
  sockets: Set<WebSocket>
  timer: NodeJS.Timeout
  frame: NodeJS.Timeout
  closed: boolean
  url: string
  browserVersion: string
  siteAddress: string
  dnsAnswers: string[]
}

export class SessionHub {
  private readonly sessions = new Map<string, LiveSession>()

  constructor(
    private readonly publish: (event: WorkerEvent) => Promise<void>,
    private readonly publishAudit: (detail: Record<string, string>, input: SessionOpen) => Promise<void>,
    private readonly put: (object: ObjectPut) => Promise<void>,
    private readonly clockOffsetMs: () => Promise<number | null>,
  ) {}

  async open(input: SessionOpen): Promise<string> {
    if (!isPublicHttpUrl(input.url)) throw new Error('blocked_url')
    const answers = await lookup(new URL(input.url).hostname, { all: true })
    if (answers.length === 0 || answers.some((item) => !isPublicIp(item.address))) throw new Error('blocked_url')
    const { chromium } = await import('playwright')
    const id = randomUUID()
    const dir = await mkdtemp(path.join(tmpdir(), 'veridit-'))
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir, size: { width: 1280, height: 720 } },
    })
    const page = await context.newPage()
    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const session: LiveSession = {
      id,
      input,
      startedAt: new Date(),
      browser,
      context,
      page,
      shots: [],
      sockets: new Set(),
      timer: setTimeout(() => {
        this.fail(id, 'session_expired').catch(() => undefined)
      }, VIDEO_SESSION_LIMIT_MS),
      frame: setInterval(() => {
        this.pushFrame(id).catch(() => undefined)
      }, 1000),
      closed: false,
      url: page.url(),
      browserVersion: browser.version(),
      siteAddress: answers[0]?.address ?? '',
      dnsAnswers: answers.map((item) => item.address),
    }
    this.sessions.set(id, session)
    await this.snapshot(session, 'shot-01')
    return id
  }

  async discard(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return
    await this.closeQuiet(session)
  }

  async conclude(id: string, publicId: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session || session.closed) throw new Error('missing_session')
    session.closed = true
    clearTimeout(session.timer)
    clearInterval(session.frame)
    await this.snapshot(session, `shot-${String(session.shots.length + 1).padStart(2, '0')}`)
    const video = session.page.video()
    await session.context.close()
    const videoPath = video ? await video.path() : ''
    const videoBytes = videoPath ? await readFile(videoPath) : Buffer.alloc(0)
    await session.browser.close()
    this.sessions.delete(id)
    if (videoBytes.length === 0) {
      await this.publish(errorEvent(session, 'empty_video'))
      return
    }
    await this.storeBundle(session, videoBytes, publicId)
  }

  attach(id: string, accountId: string, socket: WebSocket): void {
    const session = this.sessions.get(id)
    if (!session || session.input.accountId !== accountId || session.closed) {
      socket.close()
      return
    }
    session.sockets.add(socket)
    socket.on('message', (raw) => {
      this.onCommand(session, raw.toString()).catch(() => undefined)
    })
    socket.on('close', () => session.sockets.delete(socket))
  }

  private async onCommand(session: LiveSession, raw: string): Promise<void> {
    if (session.closed) return
    const command = JSON.parse(raw) as { type?: string; x?: number; y?: number; key?: string; url?: string }
    if (command.type === 'click' && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      await session.page.mouse.click(command.x ?? 0, command.y ?? 0)
      await this.publishAudit({ input: 'click', x: String(command.x), y: String(command.y) }, session.input)
    } else if (command.type === 'key' && command.key && command.key.length <= 20) {
      await session.page.keyboard.press(command.key)
      await this.publishAudit({ input: 'key', key: command.key }, session.input)
    } else if (command.type === 'navigate' && command.url && isPublicHttpUrl(command.url)) {
      const answers = await lookup(new URL(command.url).hostname, { all: true })
      if (answers.some((item) => !isPublicIp(item.address))) return
      await session.page.goto(command.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      session.url = session.page.url()
      await this.snapshot(session, `shot-${String(session.shots.length + 1).padStart(2, '0')}`)
      await this.publishAudit({ input: 'navigate', url: session.url }, session.input)
    } else if (command.type === 'back') {
      await session.page.goBack({ timeout: 15_000 }).catch(() => undefined)
      await this.publishAudit({ input: 'back' }, session.input)
    } else if (command.type === 'reload') {
      await session.page.reload({ timeout: 30_000 })
      await this.publishAudit({ input: 'reload' }, session.input)
    }
  }

  private async pushFrame(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session || session.closed || session.sockets.size === 0) return
    const frame = await session.page.screenshot({ type: 'jpeg', quality: 40 })
    const payload = JSON.stringify({ type: 'frame', url: session.page.url(), jpegBase64: frame.toString('base64') })
    for (const socket of session.sockets) socket.send(payload)
  }

  private async snapshot(session: LiveSession, name: string): Promise<void> {
    if (session.shots.length >= 8) return
    const bytes = await session.page.screenshot({ type: 'png' })
    const html = Buffer.from(await session.page.content(), 'utf8')
    session.shots.push({ name: `${name}.png`, bytes, htmlName: `${name}.html`, html })
  }

  private async storeBundle(session: LiveSession, video: Buffer, publicId: string): Promise<void> {
    const finished = new Date()
    const files: ManifestFile[] = [
      named('navigation.webm', 'video/webm', video, `evidence/${session.input.recordId}/navigation.webm`),
    ]
    const puts: ObjectPut[] = [{ key: files[0]!.storageKey, body: video, sha256: files[0]!.sha256 }]
    for (const shot of session.shots) {
      const image = named(shot.name, 'image/png', shot.bytes, `evidence/${session.input.recordId}/${shot.name}`)
      const html = named(shot.htmlName, 'text/html', shot.html, `evidence/${session.input.recordId}/${shot.htmlName}`)
      files.push(image, html)
      puts.push({ key: image.storageKey, body: shot.bytes, sha256: image.sha256 })
      puts.push({ key: html.storageKey, body: shot.html, sha256: html.sha256 })
    }
    const offset = await this.clockOffsetMs()
    const manifest: Manifest = {
      recordId: session.input.recordId,
      publicId,
      accountId: session.input.accountId,
      url: session.url,
      title: session.input.title,
      startedAt: session.startedAt.toISOString(),
      finishedAt: finished.toISOString(),
      files,
      metadata: {
        siteAddress: session.siteAddress,
        dnsAnswers: session.dnsAnswers,
        tls: null,
        httpStatus: 200,
        httpHeaders: {},
        pageHtmlSha256: sha256Hex(session.shots.at(-1)?.html ?? Buffer.alloc(0)),
        browserVersion: session.browserVersion,
        clockOffsetMs: offset,
      },
    }
    const canonical = canonicalJson(manifest)
    const hash = manifestHash(manifest)
    for (const object of puts) await this.put(object)
    const manifestKey = `evidence/${session.input.recordId}/manifest.json`
    await this.put({ key: manifestKey, body: Buffer.from(canonical, 'utf8'), sha256: hash })
    await this.publish({
      type: 'CapturaExecutada',
      version: 1,
      id: randomUUID(),
      occurredAt: finished.toISOString(),
      data: {
        recordId: session.input.recordId,
        traceId: session.input.traceId,
        manifestKey,
        manifestHash: hash,
        startedAt: session.startedAt.toISOString(),
        finishedAt: finished.toISOString(),
      },
    })
  }

  private async fail(id: string, reason: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session || session.closed) return
    await this.publish(errorEvent(session, reason))
    await this.closeQuiet(session)
  }

  private async closeQuiet(session: LiveSession): Promise<void> {
    session.closed = true
    clearTimeout(session.timer)
    clearInterval(session.frame)
    this.sessions.delete(session.id)
    await session.context.close().catch(() => undefined)
    await session.browser.close().catch(() => undefined)
    for (const socket of session.sockets) socket.close()
  }
}

function named(name: string, mediaType: string, body: Buffer, storageKey: string): ManifestFile {
  return { name, mediaType, byteSize: body.length, sha256: sha256Hex(body), storageKey }
}

function errorEvent(session: LiveSession, reason: string): WorkerEvent {
  return {
    type: 'CapturaComErro',
    version: 1,
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    data: { recordId: session.input.recordId, traceId: session.input.traceId, reason },
  }
}

