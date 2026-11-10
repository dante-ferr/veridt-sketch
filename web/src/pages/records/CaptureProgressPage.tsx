import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Callout, Card, Heading, Notice, StateBadge, Text, TextLink } from '@/components/ui'
import { notifyBalanceChanged } from '@/hooks/useCreditBalance'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { CaptureStatus } from '@/types/capture'
import { captureSteps, failureMessage, stateLabel } from '@/utils/captureState'
import { formatIsoUtc } from '@/utils/format'
import './CaptureProgressPage.css'

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

  const [cancelling, setCancelling] = useState(false)

  async function cancel() {
    setCancelling(true)
    setError('')
    try {
      await api(`/v1/captures/${id}/cancel`, { method: 'POST', token: session.accessToken })
      const body = await api<CaptureStatus>(`/v1/captures/${id}`, { token: session.accessToken })
      setRow(body)
      notifyBalanceChanged()
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <AppShell>
      <div className="capture-progress">
        <TextLink to="/records">← Registros realizados</TextLink>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        {row?.state === 'FALHOU' ? (
          <Callout role="status">
            <StateBadge state={row.state} label={stateLabel[row.state]} />
            <Text>{failureMessage(row.failureReason)}</Text>
          </Callout>
        ) : row ? (
          <Card>
            <div className="capture-progress-head">
              <div>
                <Heading size="page">{row.title}</Heading>
                <p className="capture-progress-id">
                  {row.publicId} · {row.captureKind === 'screenshot' ? 'Captura de tela' : 'Vídeo de navegação'}
                </p>
              </div>
              <StateBadge state={row.state} label={stateLabel[row.state]} />
            </div>

            <dl className="capture-progress-data">
              <div><dt>Endereço do site</dt><dd>{row.url}</dd></div>
              <div><dt>Início</dt><dd>{row.startedAt ? `${formatIsoUtc(row.startedAt).slice(0, 19)} UTC` : '–'}</dd></div>
            </dl>

            <ol className="capture-steps">
              {captureSteps(row.state, row.captureKind).map((step) => (
                <li key={step.name} className={`capture-step ${step.tone}`}>
                  <span className="capture-step-name">{step.name}</span>
                  <span className="capture-step-status">{step.status}</span>
                </li>
              ))}
            </ol>

            {row.state === 'NA_FILA' || row.state === 'EM_ANDAMENTO' ? (
              <>
                <Notice size="md">Você pode fechar esta página. Enviaremos um e-mail com o hash do manifesto quando a captura for concluída.</Notice>
                <div className="capture-progress-actions">
                  {row.state === 'EM_ANDAMENTO' && row.captureKind === 'navigation_video' ? (
                    <TextLink to={`/captures/${row.id}/session`}>Abrir a sessão de gravação</TextLink>
                  ) : <span />}
                  <Button variant="danger" disabled={cancelling} onClick={() => void cancel()}>
                    {cancelling ? 'Cancelando…' : 'Cancelar captura'}
                  </Button>
                </div>
              </>
            ) : null}
            {row.state === 'CANCELADO' ? <Notice size="md">Captura cancelada. O crédito reservado voltou ao saldo.</Notice> : null}
            {row.state === 'CONCLUIDO' ? (
              <div className="capture-progress-actions">
                <span />
                <TextLink to={`/records/${row.id}`}>Ver detalhes e baixar a prova</TextLink>
              </div>
            ) : null}
          </Card>
        ) : <Text muted>Carregando o registro.</Text>}
      </div>
    </AppShell>
  )
}
