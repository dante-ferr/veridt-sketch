import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import './records.css'

export function VideoSessionPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const socketRef = useRef<WebSocket | null>(null)
  const [concluding, setConcluding] = useState(false)
  const [frame, setFrame] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session.accessToken || !id) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${window.location.host}/v1/captures/${id}/session?access_token=${encodeURIComponent(session.accessToken)}`)
    socketRef.current = socket
    socket.onmessage = (event) => {
      const body = JSON.parse(String(event.data)) as { type?: string; jpegBase64?: string; url?: string }
      if (body.type === 'frame' && body.jpegBase64) setFrame(`data:image/jpeg;base64,${body.jpegBase64}`)
      if (body.url) setUrl(body.url)
    }
    socket.onerror = () => setError('A sessão de vídeo não está aberta.')
    return () => socket.close()
  }, [session.accessToken, id])

  function send(body: unknown) {
    socketRef.current?.send(JSON.stringify(body))
  }

  return (
    <AppShell>
      <section className="panel">
        <h2>Sessão de gravação</h2>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <p className="hint">{url || 'A tela chega do navegador que roda no servidor.'}</p>
        {frame ? (
          <img
            className="frame"
            alt="Tela transmitida pelo worker"
            src={frame}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              send({
                type: 'click',
                x: Math.round(((event.clientX - rect.left) / rect.width) * 1280),
                y: Math.round(((event.clientY - rect.top) / rect.height) * 720),
              })
            }}
          />
        ) : <p>Aguardando o quadro do worker.</p>}
        <form className="row" onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const nextUrl = String(data.get('url') ?? '')
          const key = String(data.get('key') ?? '')
          if (nextUrl) send({ type: 'navigate', url: nextUrl })
          if (key) send({ type: 'key', key })
        }}>
          <input name="url" type="text" placeholder="https://exemplo.com" aria-label="Endereço no navegador do servidor" />
          <input name="key" type="text" placeholder="Tecla" aria-label="Tecla enviada ao worker" />
          <button className="secondary" type="submit">Enviar</button>
        </form>
        <div className="row">
          <button className="secondary" type="button" onClick={() => send({ type: 'back' })}>Voltar</button>
          <button className="secondary" type="button" onClick={() => send({ type: 'reload' })}>Recarregar</button>
          <button className="primary" type="button" disabled={concluding} onClick={() => {
            setConcluding(true)
            setError('')
            api(`/v1/captures/${id}/conclude`, { method: 'POST', token: session.accessToken })
              .then(() => navigate(`/captures/${id}`))
              .catch((caught) => {
                setError(userMessage(caught))
                setConcluding(false)
              })
          }}>{concluding ? 'Concluindo…' : 'Concluir gravação'}</button>
        </div>
        <p className="hint">Cliques e teclas iriam ao worker e à trilha de auditoria. Nada é gravado no seu computador. Se a conexão cair, a gravação é interrompida e fica FALHOU. A devolução do crédito fica para a ADR-003.</p>
      </section>
    </AppShell>
  )
}
