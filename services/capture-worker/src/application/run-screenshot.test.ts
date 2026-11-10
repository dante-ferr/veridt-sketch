import { describe, expect, it } from 'vitest'
import { sha256Hex } from '@veridt/evidence'
import { runScreenshot, type ObjectPut, type ScreenshotJob } from './run-screenshot'

const job: ScreenshotJob = {
  recordId: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
  publicId: 'REG-2026-000001',
  accountId: '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5',
  title: 'Página',
  url: 'https://example.com/a',
  traceId: '11111111-1111-4111-8111-111111111111',
}

describe('screenshot worker', () => {
  it('hashes files before upload and does not sign', async () => {
    const puts: ObjectPut[] = []
    const events: string[] = []
    const result = await runScreenshot(job, {
      begin: async () => true,
      observe: async () => ({
        finalUrl: job.url,
        siteAddress: '93.184.216.34',
        dnsAnswers: ['93.184.216.34'],
        tls: null,
        httpStatus: 200,
        httpHeaders: { 'content-type': 'text/html' },
        html: Buffer.from('<html>ok</html>'),
        image: Buffer.from('png-bytes'),
        browserVersion: 'Chromium test',
      }),
      putImmutable: async (object) => {
        expect(object.sha256).toBe(sha256Hex(object.body))
        puts.push(object)
      },
      publish: async (event) => {
        events.push(event.type)
      },
      clockOffsetMs: async () => 10,
      now: () => new Date('2026-11-08T18:00:00.000Z'),
    })
    expect(result).toBe('executed')
    expect(events).toEqual(['CapturaExecutada'])
    expect(puts.map((put) => put.key.endsWith('manifest.sig'))).not.toContain(true)
  })

  it('drops the job when the record is no longer NA_FILA', async () => {
    let published = false
    const result = await runScreenshot(job, {
      begin: async () => false,
      observe: async () => ({ error: 'should-not-run' }),
      putImmutable: async () => undefined,
      publish: async () => {
        published = true
      },
      clockOffsetMs: async () => 0,
      now: () => new Date(),
    })
    expect(result).toBe('rejected')
    expect(published).toBe(false)
  })

  it('publishes CapturaComErro and does not retry from this function', async () => {
    const reasons: string[] = []
    const result = await runScreenshot(job, {
      begin: async () => true,
      observe: async () => ({ error: 'page_load_failed' }),
      putImmutable: async () => {
        throw new Error('storage should not be called')
      },
      publish: async (event) => {
        if (event.type === 'CapturaComErro') reasons.push(event.data.reason)
      },
      clockOffsetMs: async () => null,
      now: () => new Date('2026-11-08T18:00:00.000Z'),
    })
    expect(result).toBe('failed')
    expect(reasons).toEqual(['page_load_failed'])
  })
})
