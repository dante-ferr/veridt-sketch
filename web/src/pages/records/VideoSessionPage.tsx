import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RemoteBrowser } from '@/components/records/RemoteBrowser'
import { SessionPanel } from '@/components/records/SessionPanel'
import { RecordingShell } from '@/components/layout/RecordingShell'
import { Button, StateBadge } from '@/components/ui'
import { useSession } from '@/hooks/useSession'
import { useVideoSession } from '@/hooks/useVideoSession'
import { api, userMessage } from '@/services/api'
import type { CaptureStatus } from '@/types/capture'
import { formatIsoUtc } from '@/utils/format'
import { formatRecordingClock } from '@/utils/remoteInput'
import './VideoSessionPage.css'

/** How often the record state is checked, to leave the screen when the recording ends. */
const STATE_POLL_MS = 3_000

export function VideoSessionPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const live = useVideoSession(id, session.accessToken)
  const [capture, setCapture] = useState<CaptureStatus | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState<'cancel' | 'conclude' | null>(null)
  const [error, setError] = useState('')

  // Record data for the header and panel; leave when the recording is no longer running.
  useEffect(() => {
    if (!session.accessToken || !id) return
    let cancelled = false
    const load = () => {
      api<CaptureStatus>(`/v1/captures/${id}`, { token: session.accessToken })
        .then((body) => {
          if (cancelled) return
          setCapture(body)
          if (body.state !== 'EM_ANDAMENTO') navigate(`/captures/${id}`, { replace: true })
        })
        .catch((caught) => {
          if (!cancelled) setError(userMessage(caught))
        })
    }
    load()
    const timer = window.setInterval(load, STATE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [session.accessToken, id, navigate])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function finish(action: 'cancel' | 'conclude') {
    setBusy(action)
    setError('')
    api(`/v1/captures/${id}/${action}`, { method: 'POST', token: session.accessToken })
      .then(() => navigate(`/captures/${id}`))
      .catch((caught) => {
        setError(userMessage(caught))
        setBusy(null)
      })
  }

  return (
    <RecordingShell
      status={
        <>
          <span className="recording-title">{capture?.title ?? '…'}</span>
          {capture ? <StateBadge state={capture.state} label={capture.state === 'EM_ANDAMENTO' ? 'Gravando' : undefined} /> : null}
          <span className="recording-clock" aria-label="Tempo de gravação">{formatRecordingClock(capture?.startedAt ?? null, now)}</span>
        </>
      }
      actions={
        <>
          <Button variant="danger" disabled={busy !== null} onClick={() => finish('cancel')}>
            {busy === 'cancel' ? 'Cancelando…' : 'Cancelar'}
          </Button>
          <Button disabled={busy !== null} onClick={() => finish('conclude')}>
            {busy === 'conclude' ? 'Concluindo…' : 'Concluir gravação'}
          </Button>
        </>
      }
    >
      {error ? <p className="alert recording-alert" role="alert">{error}</p> : null}
      <div className="recording-layout">
        <RemoteBrowser frame={live.frame} url={live.url} status={live.status} send={live.send} />
        <SessionPanel
          publicId={capture?.publicId ?? '…'}
          startedAt={capture?.startedAt ? `${formatIsoUtc(capture.startedAt).slice(0, 19)} UTC` : '…'}
        />
      </div>
    </RecordingShell>
  )
}
