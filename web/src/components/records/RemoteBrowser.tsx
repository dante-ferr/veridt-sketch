import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react'
import type { RemoteCommand, VideoSessionStatus } from '@/hooks/useVideoSession'
import { remoteKey, remotePoint } from '@/utils/remoteInput'
import './RemoteBrowser.css'

type RemoteBrowserProps = {
  frame: string
  url: string
  status: VideoSessionStatus
  send: (command: RemoteCommand) => void
}

/** Wheel input is summed and sent at most every 100ms. */
const SCROLL_FLUSH_MS = 100

/**
 * Browser frame around the live screen of the server's browser: back, reload and
 * address bar on top; clicks, keys and the mouse wheel on the screen go to the server.
 */
export function RemoteBrowser({ frame, url, status, send }: RemoteBrowserProps) {
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)
  const scroll = useRef({ dx: 0, dy: 0, timer: 0 })

  // Follow the remote page's URL unless the user is typing a new one.
  useEffect(() => {
    if (!editing && url) setAddress(url)
  }, [url, editing])

  useEffect(() => () => window.clearTimeout(scroll.current.timer), [])

  function onClick(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.focus()
    const rect = event.currentTarget.getBoundingClientRect()
    const point = remotePoint({ x: event.clientX - rect.left, y: event.clientY - rect.top }, rect)
    if (point) send({ type: 'click', ...point })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = remoteKey(event)
    if (!key) return
    event.preventDefault()
    send({ type: 'key', key })
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    scroll.current.dx += event.deltaX
    scroll.current.dy += event.deltaY
    if (scroll.current.timer) return
    scroll.current.timer = window.setTimeout(() => {
      const { dx, dy } = scroll.current
      scroll.current = { dx: 0, dy: 0, timer: 0 }
      if (dx || dy) send({ type: 'scroll', dx: Math.round(dx), dy: Math.round(dy) })
    }, SCROLL_FLUSH_MS)
  }

  return (
    <section className="remote-browser" aria-label="Navegador do servidor">
      <form
        className="remote-browser-bar"
        onSubmit={(event) => {
          event.preventDefault()
          if (address) send({ type: 'navigate', url: address })
          setEditing(false)
        }}
      >
        <button className="remote-browser-button" type="button" aria-label="Voltar" onClick={() => send({ type: 'back' })}>←</button>
        <button className="remote-browser-button" type="button" aria-label="Recarregar" onClick={() => send({ type: 'reload' })}>↻</button>
        <input
          className="remote-browser-address"
          type="text"
          inputMode="url"
          spellCheck={false}
          aria-label="Endereço no navegador do servidor"
          value={address}
          placeholder="https://"
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(event) => setAddress(event.target.value)}
        />
      </form>
      <div
        className="remote-browser-screen"
        tabIndex={0}
        role="application"
        aria-label="Tela do navegador do servidor. Clique para interagir; as teclas vão para o servidor."
        onClick={onClick}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
      >
        {frame ? (
          <img src={frame} alt="Tela transmitida ao vivo do navegador do servidor" draggable={false} />
        ) : (
          <p className="remote-browser-placeholder">Tela transmitida ao vivo do navegador que roda no servidor do Veridt</p>
        )}
        {status === 'reconnecting' ? <p className="remote-browser-status" role="status">Conexão perdida. Reconectando…</p> : null}
        {status === 'lost' ? <p className="remote-browser-status lost" role="alert">Conexão perdida. A gravação foi interrompida.</p> : null}
      </div>
    </section>
  )
}
