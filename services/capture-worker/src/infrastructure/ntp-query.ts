import { createSocket } from 'node:dgram'
import { readNtpTimestamps } from '../domain/ntp'

export function queryNtp(host: string, timeoutMs = 1500): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4')
    const packet = Buffer.alloc(48)
    packet[0] = 0x1b
    const sent = Date.now()
    const timer = setTimeout(() => {
      socket.close()
      resolve(null)
    }, timeoutMs)
    socket.once('error', () => {
      clearTimeout(timer)
      socket.close()
      resolve(null)
    })
    socket.once('message', (response) => {
      clearTimeout(timer)
      const offset = readNtpTimestamps(response, sent, Date.now())
      socket.close()
      resolve(offset)
    })
    socket.send(packet, 123, host)
  })
}
