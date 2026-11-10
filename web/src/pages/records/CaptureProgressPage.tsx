import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/ui'
import { notifyBalanceChanged } from '@/hooks/useCreditBalance'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { CaptureStatus } from '@/types/capture'
import { stateLabel, step } from '@/utils/captureState'
import { formatIsoUtc } from '@/utils/format'
import './records.css'

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
          else {
            notifyBalanceChanged()
            window.setTimeout(() => notifyBalanceChanged(), 2000)
          }
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
    notifyBalanceChanged()
  }

  return (
    <AppShell>
      <p><Link to="/records">← Registros realizados</Link></p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {row ? (
        <section className="panel">
          <div className="heading-row">
            <h2>{row.title}</h2>
            <StatusBadge tone={row.state}>{row.state} · {stateLabel[row.state]}</StatusBadge>
          </div>
          <p className="hint">{row.publicId} · {row.captureKind === 'screenshot' ? 'Captura de tela' : 'Vídeo de navegação'}</p>
          <div className="meta">
            <div><span>Endereço do site</span><strong>{row.url}</strong></div>
            <div><span>Início</span><strong>{formatIsoUtc(row.startedAt)} UTC</strong></div>
          </div>
          <ul className="steps">
            <li><span>Reserva de crédito</span><em>1 crédito reservado antes do início. Volta se a captura falhar ou for cancelada.</em></li>
            <li><span>Na fila de captura</span><em>{row.captureKind === 'navigation_video' ? 'Não se aplica ao vídeo' : step(row.state, 'queued')}</em></li>
            <li><span>Abrindo o site e capturando</span><em>{step(row.state, 'running')}</em></li>
            <li><span>Cálculo dos hashes e assinatura do manifesto</span><em>{step(row.state, 'sign')}</em></li>
            <li><span>E-mail de conclusão</span><em>{row.state === 'CONCLUIDO' ? 'Pedido publicado' : 'Aguardando'}</em></li>
          </ul>
          {row.state === 'FALHOU' ? (
            <p className="failbox" role="status">A captura falhou ({row.failureReason ?? 'erro'}). Ela não é refeita. O crédito reservado volta ao saldo.</p>
          ) : null}
          {row.state === 'CANCELADO' ? (
            <p className="hint">Captura cancelada. O crédito reservado volta ao saldo.</p>
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
    </AppShell>
  )
}
