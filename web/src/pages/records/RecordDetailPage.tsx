import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/ui'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { RecordDetail } from '@/types/capture'
import { stateLabel } from '@/utils/captureState'
import { formatIsoUtc } from '@/utils/format'
import './records.css'

export function RecordDetailPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const [row, setRow] = useState<RecordDetail | null>(null)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => {
    if (!session.accessToken || !id) return
    api<RecordDetail>(`/v1/records/${id}`, { token: session.accessToken })
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
    <AppShell>
      <p><Link to="/records">← Registros realizados</Link></p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {row ? (
        <>
          <div className="heading-row">
            <div>
              <h2>{row.title}</h2>
              <StatusBadge tone={row.state}>{row.state} · {stateLabel[row.state]}</StatusBadge>
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
                <div><span>Início</span><strong>{formatIsoUtc(row.startedAt)} UTC</strong></div>
                <div><span>Fim</span><strong>{formatIsoUtc(row.finishedAt)} UTC</strong></div>
                <div><span>Endereço do site</span><strong>{row.url}</strong></div>
              </div>
            </section>
            <section className="panel">
              <h3>Integridade</h3>
              <p>Hash do manifesto SHA-256</p>
              <p><code>{row.manifestHash ?? 'Ainda não assinado'}</code></p>
              <button className="secondary" type="button" onClick={() => void copyHash()}>Copiar</button>
              <p>{row.signature ? 'Assinatura presente. Confira com a chave pública do Veridt.' : 'Sem assinatura.'}</p>
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
    </AppShell>
  )
}
