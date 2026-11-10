import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { RecordListItem } from '@/types/capture'
import { formatIsoUtc } from '@/utils/format'
import './records.css'

export function RecordsPage() {
  const session = useSession()
  const [title, setTitle] = useState('')
  const [state, setState] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<RecordListItem[]>([])
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
    <AppShell>
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
              <td>{formatIsoUtc(item.startedAt)}</td>
              <td>{formatIsoUtc(item.finishedAt)}</td>
              <td><StatusBadge tone={item.state}>{item.state}</StatusBadge></td>
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
    </AppShell>
  )
}
