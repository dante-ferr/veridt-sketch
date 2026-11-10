export function ntpOffsetMs(input: {
  clientSentMs: number
  serverReceivedMs: number
  serverSentMs: number
  clientReceivedMs: number
}): number {
  return Math.round(((input.serverReceivedMs - input.clientSentMs) + (input.serverSentMs - input.clientReceivedMs)) / 2)
}

const NTP_EPOCH_DELTA_MS = 2208988800000

export function readNtpTimestamps(packet: Buffer, clientSentMs: number, clientReceivedMs: number): number | null {
  if (packet.length < 48) return null
  const serverReceivedMs = ntpTimeMs(packet, 32)
  const serverSentMs = ntpTimeMs(packet, 40)
  if (serverReceivedMs === null || serverSentMs === null) return null
  return ntpOffsetMs({ clientSentMs, serverReceivedMs, serverSentMs, clientReceivedMs })
}

function ntpTimeMs(packet: Buffer, offset: number): number | null {
  const seconds = packet.readUInt32BE(offset)
  const fraction = packet.readUInt32BE(offset + 4)
  if (seconds === 0) return null
  return seconds * 1000 + Math.round((fraction * 1000) / 2 ** 32) - NTP_EPOCH_DELTA_MS
}

export function writeNtpTime(packet: Buffer, offset: number, unixMs: number): void {
  const ntpMs = unixMs + NTP_EPOCH_DELTA_MS
  const seconds = Math.floor(ntpMs / 1000)
  const fraction = Math.round(((ntpMs % 1000) * 2 ** 32) / 1000)
  packet.writeUInt32BE(seconds, offset)
  packet.writeUInt32BE(fraction, offset + 4)
}
