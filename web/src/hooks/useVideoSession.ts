import { useCallback, useEffect, useRef, useState } from 'react'

export type VideoSessionStatus = 'connecting' | 'live' | 'reconnecting' | 'lost'

/** Commands understood by the capture worker. */
export type RemoteCommand =
  | { type: 'click'; x: number; y: number }
  | { type: 'key'; key: string }
  | { type: 'scroll'; dx: number; dy: number }
  | { type: 'navigate'; url: string }
  | { type: 'back' }
  | { type: 'reload' }

/** How long the page keeps retrying; the worker fails the recording after 30s without a screen. */
const RECONNECT_WINDOW_MS = 25_000
const RECONNECT_DELAY_MS = 1_500

/**
 * WebSocket to the live video session (through the gateway): latest frame and URL,
 * a `send` for remote commands, and automatic reconnects after a drop.
 */
export function useVideoSession(captureId: string, accessToken: string) {
  const socketRef = useRef<WebSocket | null>(null)
  const [frame, setFrame] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<VideoSessionStatus>('connecting')

  useEffect(() => {
    if (!captureId || !accessToken) return
    let disposed = false
    let lostSince = 0
    let retry: number | undefined

    const open = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/v1/captures/${captureId}/session?access_token=${encodeURIComponent(accessToken)}`,
      )
      socketRef.current = socket
      socket.onmessage = (event) => {
        const body = JSON.parse(String(event.data)) as { type?: string; jpegBase64?: string; url?: string }
        if (body.type === 'frame' && body.jpegBase64) {
          lostSince = 0
          setStatus('live')
          setFrame(`data:image/jpeg;base64,${body.jpegBase64}`)
        }
        if (body.url) setUrl(body.url)
      }
      socket.onclose = () => {
        if (disposed) return
        socketRef.current = null
        lostSince ||= Date.now()
        if (Date.now() - lostSince > RECONNECT_WINDOW_MS) {
          setStatus('lost')
          return
        }
        setStatus('reconnecting')
        retry = window.setTimeout(open, RECONNECT_DELAY_MS)
      }
    }

    open()
    return () => {
      disposed = true
      window.clearTimeout(retry)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [captureId, accessToken])

  const send = useCallback((command: RemoteCommand) => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command))
  }, [])

  return { frame, url, status, send }
}
