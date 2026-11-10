import { describe, expect, it } from 'vitest'
import { ntpOffsetMs, readNtpTimestamps, writeNtpTime } from './ntp'

describe('ntp offset', () => {
  it('alerts from a one-second server lead', () => {
    expect(ntpOffsetMs({
      clientSentMs: 1_000,
      serverReceivedMs: 2_100,
      serverSentMs: 2_100,
      clientReceivedMs: 1_200,
    })).toBe(1000)
  })

  it('reads the offset from an NTP packet', () => {
    const packet = Buffer.alloc(48)
    writeNtpTime(packet, 32, 5_000)
    writeNtpTime(packet, 40, 5_010)
    expect(readNtpTimestamps(packet, 4_000, 4_020)).toBe(995)
  })
})
