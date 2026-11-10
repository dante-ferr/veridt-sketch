import { lookup } from 'node:dns/promises'
import { PAGE_LOAD_TIMEOUT_MS } from '@veridt/evidence'
import type { ObservedPage } from '../application/run-screenshot'

type SecurityDetails = {
  subjectName?: string
  issuer?: string
  validFrom?: number
  validTo?: number
  protocol?: string
}

export async function observeWithChromium(url: string): Promise<ObservedPage | { error: string }> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT_MS })
    if (!response) return { error: 'page_load_failed' }
    const html = Buffer.from(await page.content(), 'utf8')
    const image = await page.screenshot({ fullPage: true, type: 'png' })
    const hostname = new URL(page.url()).hostname
    const answers = await lookup(hostname, { all: true })
    const security = await readSecurity(response)
    return {
      finalUrl: page.url(),
      siteAddress: answers[0]?.address ?? '',
      dnsAnswers: answers.map((item) => item.address),
      tls: security,
      httpStatus: response.status(),
      httpHeaders: response.headers(),
      html,
      image,
      browserVersion: browser.version(),
    }
  } catch {
    return { error: 'page_load_failed' }
  } finally {
    await browser.close()
  }
}

async function readSecurity(response: { securityDetails?: () => Promise<SecurityDetails | null> }): Promise<ObservedPage['tls']> {
  if (!response.securityDetails) return null
  const details = await response.securityDetails()
  if (!details?.protocol) return null
  return {
    subject: details.subjectName ?? '',
    issuer: details.issuer ?? '',
    validFrom: details.validFrom ? new Date(details.validFrom * 1000).toISOString() : '',
    validTo: details.validTo ? new Date(details.validTo * 1000).toISOString() : '',
    protocol: details.protocol,
  }
}
