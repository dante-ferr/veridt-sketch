import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Card, CopyBox, Heading, Hint, StateBadge, Text, TextLink } from '@/components/ui'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { RecordDetail } from '@/types/capture'
import { stateLabel } from '@/utils/captureState'
import { describeDataTypes, fileKind, fileKindLabel, formatFileSize, summarizeFiles } from '@/utils/files'
import { formatIsoUtc } from '@/utils/format'
import './RecordDetailPage.css'

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

  return (
    <AppShell>
      <div className="record-detail">
        <TextLink to="/records">← Registros realizados</TextLink>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        {row ? (
          <>
            <div className="record-detail-header">
              <div className="record-detail-title">
                <Heading size="page">{row.title}</Heading>
                <StateBadge state={row.state} label={stateLabel[row.state]} />
              </div>
              <div className="record-detail-actions">
                <Button variant="outline" onClick={() => void download('archive')}>Baixar arquivo zip</Button>
                <Button onClick={() => void download('report')}>Baixar relatório</Button>
              </div>
            </div>

            <div className="record-detail-grid">
              <Card>
                <Heading size="card">Dados do registro</Heading>
                <dl className="record-meta">
                  <div><dt>Id do registro</dt><dd className="mono">{row.publicId}</dd></div>
                  <div><dt>Usuário responsável</dt><dd>{row.fullName}</dd></div>
                  <div><dt>Início</dt><dd className="mono">{withUtc(row.startedAt)}</dd></div>
                  <div><dt>Fim</dt><dd className="mono">{withUtc(row.finishedAt)}</dd></div>
                  <div><dt>Tipos de dados registrados</dt><dd>{describeDataTypes(row.files)}</dd></div>
                  <div><dt>Arquivos</dt><dd>{summarizeFiles(row.files)}</dd></div>
                  <div className="wide"><dt>Endereço do site</dt><dd className="mono">{row.url}</dd></div>
                </dl>
              </Card>

              <Card as="aside">
                <Heading size="card">Integridade</Heading>
                <CopyBox title="Hash do manifesto" tag="SHA-256" value={row.manifestHash ?? ''} emptyText="Ainda não assinado" />
                {row.signature ? (
                  <Text><strong className="signature-status">Manifesto assinado</strong> pelo Veridt. A validade não é conferida nesta tela.</Text>
                ) : (
                  <Text>Sem assinatura.</Text>
                )}
                <Hint>
                  Este hash foi enviado ao seu e-mail na conclusão. Confira a assinatura com a{' '}
                  <TextLink to="/capture/signing-key" className="hint-link">chave pública do Veridt</TextLink>.
                </Hint>
              </Card>
            </div>

            <Card>
              <Heading size="card">Arquivos capturados</Heading>
              <table className="data-table files-table">
                <thead><tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th>Hash SHA-256</th></tr></thead>
                <tbody>
                  {row.files.map((file) => (
                    <tr key={file.name} data-kind={fileKind(file.mediaType)}>
                      <td>{file.name}</td>
                      <td className="sans">{fileKindLabel(file.mediaType)}</td>
                      <td className="sans">{formatFileSize(file.byteSize)}</td>
                      <td className="hash">{file.sha256}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Hint>Os downloads usam um link temporário, válido por poucos minutos. Cada download fica registrado na trilha de auditoria.</Hint>
              {link ? <Hint>Último link gerado.</Hint> : null}
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

/** "2026-10-18 09:12:44 UTC" (no milliseconds); "–" when there is no date. */
function withUtc(value: string | null): string {
  return value ? `${formatIsoUtc(value).slice(0, 19)} UTC` : formatIsoUtc(value)
}
