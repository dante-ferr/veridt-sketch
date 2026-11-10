import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { api, userMessage } from './api'
import { useSession } from './session'

type CaptureKind = 'screenshot' | 'navigation_video'
type RecordState = 'NA_FILA' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO'

const stateLabel: Record<RecordState, string> = {
  NA_FILA: 'Na fila',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
}

export function Shell({ children }: { children: ReactNode }) {
  const session = useSession()
  return (
    <div className="shell">
      <header className="appbar">
        <div className="brand">
          <Link to="/records">Veridit</Link>
          <nav>
            <NavLink to="/records">Registros</NavLink>
            <NavLink to="/records/new">Novo registro</NavLink>
            <NavLink to="/credits">Créditos</NavLink>
            <NavLink to="/account">Minha conta</NavLink>
          </nav>
        </div>
        <div className="who">
          <span>Créditos indisponíveis</span>
          <span>{session.fullName || '…'}</span>
          <button className="secondary" type="button" onClick={() => void session.signOut()} disabled={session.pending}>Sair</button>
        </div>
      </header>
      {session.error ? <p className="alert" role="alert">{session.error}</p> : null}
      <div className="canvas">{children}</div>
    </div>
  )
}

export function RecordsPage() {
  const session = useSession()
  const [title, setTitle] = useState('')
  const [state, setState] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<Array<{
    id: string
    publicId: string
    title: string
    state: RecordState
    startedAt: string | null
    finishedAt: string | null
  }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session.accessToken) return
    const params = new URLSearchParams({ page: String(page) })
    if (title.trim()) params.set('title', title.trim())
    if (state !== 'all') params.set('state', state)
    api<{ total: number; items: typeof items }>(`/v1/records?${params}`, { token: session.accessToken })
      .then((body) => {
        setTotal(body.total)
        setItems(body.items)
        setError('')
      })
      .catch((caught) => setError(userMessage(caught)))
  }, [session.accessToken, title, state, page])

  const from = total === 0 ? 0 : (page - 1) * 5 + 1
  const to = Math.min(page * 5, total)

  return (
    <Shell>
      <div className="heading-row">
        <div>
          <h2>Registros realizados</h2>
          <p className="hint">Horários em UTC, ordenados pela data de início.</p>
        </div>
        <Link className="button" to="/records/new">Iniciar registro</Link>
      </div>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      <div className="filters">
        <div className="field">
          <label htmlFor="search-title">Buscar por título</label>
          <input id="search-title" value={title} placeholder="Ex.: publicação" onChange={(event) => { setTitle(event.target.value); setPage(1) }} />
        </div>
        <div className="field">
          <label htmlFor="search-state">Estado</label>
          <select id="search-state" value={state} onChange={(event) => { setState(event.target.value); setPage(1) }}>
            <option value="all">Todos</option>
            <option value="NA_FILA">NA_FILA</option>
            <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="FALHOU">FALHOU</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>
        </div>
      </div>
      <table className="grid">
        <thead>
          <tr><th>Título</th><th>Início (UTC)</th><th>Fim (UTC)</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={5}>Nenhum registro ainda. A reserva de crédito está bloqueada até a ADR-003.</td></tr>
          ) : items.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.title}</strong><div className="hint">{item.publicId}</div></td>
              <td>{formatUtc(item.startedAt)}</td>
              <td>{formatUtc(item.finishedAt)}</td>
              <td><span className={`badge ${item.state}`}>{item.state}</span></td>
              <td>
                {item.state === 'NA_FILA' || item.state === 'EM_ANDAMENTO'
                  ? <Link to={`/captures/${item.id}`}>Acompanhar</Link>
                  : <Link to={`/records/${item.id}`}>Detalhes</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <span>Mostrando {from}–{to} de {total} registros</span>
        <span>
          <button className="secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <button className="secondary" type="button" disabled={page * 5 >= total} onClick={() => setPage(page + 1)}>Próxima</button>
        </span>
      </div>
    </Shell>
  )
}

export function NewRecordPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [captureKind, setCaptureKind] = useState<CaptureKind>('screenshot')
  const [url, setUrl] = useState('https://')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const created = await api<{ id: string; captureKind: string }>('/v1/captures', {
        method: 'POST',
        token: session.accessToken,
        body: { captureKind, url, title },
      })
      navigate(created.captureKind === 'navigation_video' ? `/captures/${created.id}/session` : `/captures/${created.id}`)
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <Shell>
      <form className="split-page" onSubmit={onSubmit}>
        <section className="panel">
          <h2>Novo registro</h2>
          {error ? <p className="alert" role="alert">{error}</p> : null}
          <p className="label">Tipo de captura</p>
          <div className="types">
            <label className={captureKind === 'screenshot' ? 'type selected' : 'type'}>
              <input type="radio" name="kind" checked={captureKind === 'screenshot'} onChange={() => setCaptureKind('screenshot')} />
              <span><strong>Captura de tela</strong>Imagem da página inteira, feita no servidor. Entra na fila e conclui sozinha.</span>
            </label>
            <label className={captureKind === 'navigation_video' ? 'type selected' : 'type'}>
              <input type="radio" name="kind" checked={captureKind === 'navigation_video'} onChange={() => setCaptureKind('navigation_video')} />
              <span><strong>Vídeo de navegação</strong>Você navega ao vivo num navegador do servidor; tudo é gravado.</span>
            </label>
          </div>
          <div className="field">
            <label htmlFor="site-url">Endereço do site</label>
            <input id="site-url" required value={url} onChange={(event) => setUrl(event.target.value)} />
            <p className="hint">Endereços da rede interna ou privados são bloqueados.</p>
          </div>
          <div className="field">
            <label htmlFor="record-title">Título do registro</label>
            <input id="record-title" required value={title} placeholder="Ex.: Publicação em rede social" onChange={(event) => setTitle(event.target.value)} />
            <p className="hint">Aparece na listagem e no relatório.</p>
          </div>
          <div className="row">
            <p className="hint">Custo: 1 crédito, reservado agora e devolvido se a captura falhar. A reserva está bloqueada até a ADR-003, então o registro não começa.</p>
            <button className="primary" type="submit" disabled={pending || !session.accessToken}>Iniciar registro</button>
          </div>
        </section>
        <aside className="panel">
          <h2>Como a prova é gerada</h2>
          <ol>
            <li>Um navegador novo, sem cookies, abre o site no servidor do Veridit.</li>
            <li>Cada arquivo recebe um hash SHA-256 logo após a captura.</li>
            <li>O manifesto é assinado digitalmente e guardado sem possibilidade de edição.</li>
            <li>Você recebe por e-mail o hash do manifesto ao concluir.</li>
          </ol>
          <p className="hint">Data e hora vêm do servidor, em UTC. O relógio do seu computador não é usado.</p>
        </aside>
      </form>
    </Shell>
  )
}

export function CaptureProgressPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const [row, setRow] = useState<CaptureStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session.accessToken || !id) return
    let timer: number | undefined
    const load = () => {
      api<CaptureStatus>(`/v1/captures/${id}`, { token: session.accessToken })
        .then((body) => {
          setRow(body)
          if (body.state === 'NA_FILA' || body.state === 'EM_ANDAMENTO') timer = window.setTimeout(load, 2000)
        })
        .catch((caught) => setError(userMessage(caught)))
    }
    load()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [session.accessToken, id])

  async function cancel() {
    await api(`/v1/captures/${id}/cancel`, { method: 'POST', token: session.accessToken })
    const body = await api<CaptureStatus>(`/v1/captures/${id}`, { token: session.accessToken })
    setRow(body)
  }

  return (
    <Shell>
      <p><Link to="/records">← Registros realizados</Link></p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {row ? (
        <section className="panel">
          <div className="heading-row">
            <h2>{row.title}</h2>
            <span className={`badge ${row.state}`}>{row.state} · {stateLabel[row.state]}</span>
          </div>
          <p className="hint">{row.publicId} · {row.captureKind === 'screenshot' ? 'Captura de tela' : 'Vídeo de navegação'}</p>
          <div className="meta">
            <div><span>Endereço do site</span><strong>{row.url}</strong></div>
            <div><span>Início</span><strong>{formatUtc(row.startedAt)} UTC</strong></div>
          </div>
          <ul className="steps">
            <li><span>Reserva de crédito</span><em>Aceita só quando a porta de créditos reservar. Nesta fatia ela bloqueia o início.</em></li>
            <li><span>Na fila de captura</span><em>{row.captureKind === 'navigation_video' ? 'Não se aplica ao vídeo' : step(row.state, 'queued')}</em></li>
            <li><span>Abrindo o site e capturando</span><em>{step(row.state, 'running')}</em></li>
            <li><span>Cálculo dos hashes e assinatura do manifesto</span><em>{step(row.state, 'sign')}</em></li>
            <li><span>E-mail de conclusão</span><em>{row.state === 'CONCLUIDO' ? 'Pedido publicado' : 'Aguardando'}</em></li>
          </ul>
          {row.state === 'FALHOU' ? (
            <p className="failbox" role="status">A captura falhou ({row.failureReason ?? 'erro'}). Ela não é refeita. A devolução do crédito fica para a ADR-003.</p>
          ) : null}
          {row.state === 'CANCELADO' ? (
            <p className="hint">Captura cancelada. A devolução do crédito fica para a ADR-003.</p>
          ) : null}
          {row.state === 'NA_FILA' || row.state === 'EM_ANDAMENTO' ? (
            <div className="row">
              <p className="hint">Você pode fechar esta página. O e-mail leva o hash do manifesto quando a captura concluir.</p>
              <button className="secondary" type="button" onClick={() => void cancel()}>Cancelar captura</button>
            </div>
          ) : null}
          {row.state === 'EM_ANDAMENTO' && row.captureKind === 'navigation_video' ? (
            <p><Link to={`/captures/${row.id}/session`}>Abrir a sessão de gravação</Link></p>
          ) : null}
        </section>
      ) : <p>Carregando o registro.</p>}
    </Shell>
  )
}

export function VideoSessionPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const socketRef = useRef<WebSocket | null>(null)
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
    socket.onerror = () => setError('A sessão de vídeo não está aberta. A reserva de crédito bloqueia o início até a ADR-003.')
    return () => socket.close()
  }, [session.accessToken, id])

  function send(body: unknown) {
    socketRef.current?.send(JSON.stringify(body))
  }

  return (
    <Shell>
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
          <button className="primary" type="button" onClick={() => void api(`/v1/captures/${id}/conclude`, { method: 'POST', token: session.accessToken })}>Concluir gravação</button>
        </div>
        <p className="hint">Cliques e teclas iriam ao worker e à trilha de auditoria. Nada é gravado no seu computador. Se a conexão cair, a gravação é interrompida e fica FALHOU. A devolução do crédito fica para a ADR-003.</p>
      </section>
    </Shell>
  )
}

export function RecordDetailPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const [row, setRow] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => {
    if (!session.accessToken || !id) return
    api<Detail>(`/v1/records/${id}`, { token: session.accessToken })
      .then(setRow)
      .catch((caught) => setError(userMessage(caught)))
  }, [session.accessToken, id])

  async function download(artifact: 'report' | 'archive') {
    setError('')
    try {
      const body = await api<{ url: string }>(`/v1/records/${id}/downloads`, {
        method: 'POST',
        token: session.accessToken,
        body: { artifact },
      })
      setLink(body.url)
      window.open(body.url, '_blank', 'noopener')
    } catch (caught) {
      setError(userMessage(caught))
    }
  }

  async function copyHash() {
    if (row?.manifestHash) await navigator.clipboard.writeText(row.manifestHash)
  }

  return (
    <Shell>
      <p><Link to="/records">← Registros realizados</Link></p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {row ? (
        <>
          <div className="heading-row">
            <div>
              <h2>{row.title}</h2>
              <span className={`badge ${row.state}`}>{row.state} · {stateLabel[row.state]}</span>
            </div>
            <div className="row">
              <button className="secondary" type="button" onClick={() => void download('archive')}>Baixar arquivo zip</button>
              <button className="primary" type="button" onClick={() => void download('report')}>Baixar relatório</button>
            </div>
          </div>
          <div className="split-page">
            <section className="panel">
              <h3>Dados do registro</h3>
              <div className="meta">
                <div><span>Id do registro</span><strong>{row.publicId}</strong></div>
                <div><span>Usuário responsável</span><strong>{row.fullName}</strong></div>
                <div><span>Início</span><strong>{formatUtc(row.startedAt)} UTC</strong></div>
                <div><span>Fim</span><strong>{formatUtc(row.finishedAt)} UTC</strong></div>
                <div><span>Endereço do site</span><strong>{row.url}</strong></div>
              </div>
            </section>
            <section className="panel">
              <h3>Integridade</h3>
              <p>Hash do manifesto SHA-256</p>
              <p><code>{row.manifestHash ?? 'Ainda não assinado'}</code></p>
              <button className="secondary" type="button" onClick={() => void copyHash()}>Copiar</button>
              <p>{row.signature ? 'Assinatura presente. Confira com a chave pública do Veridit.' : 'Sem assinatura.'}</p>
              <p className="hint"><Link to="/capture/signing-key">Chave pública</Link></p>
            </section>
          </div>
          <section className="panel">
            <h3>Arquivos capturados</h3>
            <table className="grid">
              <thead><tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th>Hash SHA-256</th></tr></thead>
              <tbody>
                {row.files.map((file) => (
                  <tr key={file.name}><td>{file.name}</td><td>{file.mediaType}</td><td>{file.byteSize}</td><td><code>{file.sha256}</code></td></tr>
                ))}
              </tbody>
            </table>
            <p className="hint">Os downloads usam um link temporário, válido por poucos minutos. Cada download fica na trilha de auditoria.</p>
            {link ? <p className="hint">Último link gerado.</p> : null}
          </section>
        </>
      ) : null}
    </Shell>
  )
}

export function CreditsPage() {
  return (
    <Shell>
      <section className="panel">
        <h2>Créditos</h2>
        <p>Não há saldo, pacote nem compra nesta fatia. A reserva de crédito fica bloqueada até a ADR-003. Sem essa reserva, a captura não grava um registro.</p>
      </section>
    </Shell>
  )
}

export function AccountPage() {
  const session = useSession()
  return (
    <Shell>
      <section className="panel">
        <h2>Minha conta</h2>
        <p>{session.fullName ? `Olá, ${session.fullName}.` : 'Carregando a sessão.'}</p>
        <p className="hint">Telefone, endereço e faturamento entram só com a compra de créditos, na ADR-003.</p>
      </section>
    </Shell>
  )
}

export function SigningKeyPage() {
  const [pem, setPem] = useState('')
  useEffect(() => {
    api<{ publicKeyPem: string }>('/v1/capture/signing-key').then((body) => setPem(body.publicKeyPem)).catch(() => setPem(''))
  }, [])
  return (
    <main className="page">
      <h1>Chave pública do manifesto</h1>
      <pre className="key">{pem || 'Carregando a chave.'}</pre>
    </main>
  )
}

type CaptureStatus = {
  id: string
  publicId: string
  title: string
  url: string
  captureKind: 'screenshot' | 'navigation_video'
  state: RecordState
  startedAt: string | null
  finishedAt: string | null
  failureReason: string | null
}

type Detail = {
  id: string
  publicId: string
  title: string
  url: string
  captureKind: string
  state: RecordState
  fullName: string
  startedAt: string | null
  finishedAt: string | null
  manifestHash: string | null
  signature: string | null
  files: Array<{ name: string; mediaType: string; byteSize: number; sha256: string }>
}

function formatUtc(value: string | null): string {
  if (!value) return '–'
  return value.replace('T', ' ').replace('.000Z', '').replace('Z', '')
}

function step(state: RecordState, name: 'queued' | 'running' | 'sign'): string {
  if (state === 'FALHOU' || state === 'CANCELADO') return stateLabel[state]
  if (name === 'queued') return state === 'NA_FILA' ? 'Em andamento' : 'Feito'
  if (name === 'running') return state === 'EM_ANDAMENTO' ? 'Em andamento' : state === 'CONCLUIDO' ? 'Feito' : 'Aguardando'
  return state === 'CONCLUIDO' ? 'Feito' : 'Aguardando'
}
