import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ActionRow, Button, Card, Field, Heading, Hint, Input, Text } from '@/components/ui'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { CaptureKind } from '@/types/capture'
import './NewRecordPage.css'

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
    <AppShell>
      <form className="new-record" onSubmit={onSubmit}>
        <Card as="section" className="new-record-form">
          <Heading size="page">Novo registro</Heading>
          {error ? <p className="alert" role="alert">{error}</p> : null}
          <div className="option-group">
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
          </div>
          <Field label="Endereço do site" htmlFor="site-url" hint="Endereços da rede interna ou privados são bloqueados.">
            <Input id="site-url" required value={url} placeholder="https://exemplo.com.br" onChange={(event) => setUrl(event.target.value)} />
          </Field>
          <Field label="Título do registro" htmlFor="record-title" hint="Aparece na listagem e no relatório.">
            <Input id="record-title" required value={title} placeholder="Ex.: Publicação em rede social" onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <ActionRow divided>
            <Text>Custo: 1 crédito, reservado agora e devolvido se a captura falhar.</Text>
            <Button type="submit" disabled={pending || !session.accessToken}>Iniciar registro</Button>
          </ActionRow>
        </Card>
        <Card as="aside" className="new-record-how">
          <Heading size="card">Como a prova é gerada</Heading>
          <ol>
            <li>Um navegador novo, sem cookies, abre o site no servidor do Veridt.</li>
            <li>Cada arquivo recebe um hash SHA-256 logo após a captura.</li>
            <li>O manifesto é assinado digitalmente e guardado sem possibilidade de edição.</li>
            <li>Você recebe por e-mail o hash do manifesto ao concluir.</li>
          </ol>
          <Hint>Data e hora vêm do servidor, em UTC. O relógio do seu computador não é usado.</Hint>
        </Card>
      </form>
    </AppShell>
  )
}
