import { randomUUID } from 'node:crypto'
import type { WorkerEvent } from '@veridt/events'
import {
  canonicalJson,
  clockNeedsAlert,
  isPublicIp,
  manifestHash,
  sha256Hex,
  type CaptureMetadata,
  type Manifest,
  type ManifestFile,
} from '@veridt/evidence'

export type ScreenshotJob = {
  recordId: string
  publicId: string
  accountId: string
  title: string
  url: string
  traceId: string
}

export type ObservedPage = {
  finalUrl: string
  siteAddress: string
  dnsAnswers: string[]
  tls: CaptureMetadata['tls']
  httpStatus: number
  httpHeaders: Record<string, string>
  html: Buffer
  image: Buffer
  browserVersion: string
}

export type ObjectPut = { key: string; body: Buffer; sha256: string }

export type ScreenshotDeps = {
  begin: (recordId: string) => Promise<boolean>
  observe: (url: string) => Promise<ObservedPage | { error: string }>
  putImmutable: (object: ObjectPut) => Promise<void>
  publish: (event: WorkerEvent) => Promise<void>
  clockOffsetMs: () => Promise<number | null>
  now: () => Date
}

export async function runScreenshot(job: ScreenshotJob, deps: ScreenshotDeps): Promise<'executed' | 'rejected' | 'failed'> {
  const offset = await deps.clockOffsetMs()
  if (clockNeedsAlert(offset)) {
    console.log(JSON.stringify({ msg: 'clock_alert', offsetMs: offset }))
  }
  const accepted = await deps.begin(job.recordId)
  if (!accepted) return 'rejected'
  const started = deps.now()
  const observed = await deps.observe(job.url)
  if ('error' in observed) {
    await deps.publish(errorEvent(job, observed.error, deps.now()))
    return 'failed'
  }
  if (!isPublicIp(observed.siteAddress) || observed.dnsAnswers.some((answer) => !isPublicIp(answer))) {
    await deps.publish(errorEvent(job, 'private_address', deps.now()))
    return 'failed'
  }
  const finished = deps.now()
  const htmlKey = `evidence/${job.recordId}/page.html`
  const imageKey = `evidence/${job.recordId}/capture.png`
  const files: ManifestFile[] = [
    file('capture.png', 'image/png', observed.image, imageKey),
    file('page.html', 'text/html', observed.html, htmlKey),
  ]
  const manifest: Manifest = {
    recordId: job.recordId,
    publicId: job.publicId,
    accountId: job.accountId,
    url: observed.finalUrl,
    title: job.title,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    files,
    metadata: {
      siteAddress: observed.siteAddress,
      dnsAnswers: observed.dnsAnswers,
      tls: observed.tls,
      httpStatus: observed.httpStatus,
      httpHeaders: observed.httpHeaders,
      pageHtmlSha256: sha256Hex(observed.html),
      browserVersion: observed.browserVersion,
      clockOffsetMs: offset,
    },
  }
  const canonical = canonicalJson(manifest)
  const hash = manifestHash(manifest)
  await deps.putImmutable({ key: imageKey, body: observed.image, sha256: sha256Hex(observed.image) })
  await deps.putImmutable({ key: htmlKey, body: observed.html, sha256: sha256Hex(observed.html) })
  await deps.putImmutable({
    key: `evidence/${job.recordId}/manifest.json`,
    body: Buffer.from(canonical, 'utf8'),
    sha256: hash,
  })
  await deps.publish({
    type: 'CapturaExecutada',
    version: 1,
    id: randomUUID(),
    occurredAt: finished.toISOString(),
    data: {
      recordId: job.recordId,
      traceId: job.traceId,
      manifestKey: `evidence/${job.recordId}/manifest.json`,
      manifestHash: hash,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
    },
  })
  return 'executed'
}

function file(name: string, mediaType: string, body: Buffer, storageKey: string): ManifestFile {
  return { name, mediaType, byteSize: body.length, sha256: sha256Hex(body), storageKey }
}

function errorEvent(job: ScreenshotJob, reason: string, now: Date): WorkerEvent {
  return {
    type: 'CapturaComErro',
    version: 1,
    id: randomUUID(),
    occurredAt: now.toISOString(),
    data: { recordId: job.recordId, traceId: job.traceId, reason },
  }
}
