import { Card, Heading, Hint, Notice } from '@/components/ui'
import './SessionPanel.css'

type SessionPanelProps = {
  publicId: string
  startedAt: string
}

/** Side card of the recording screen: record id, start time and what happens to the recording. */
export function SessionPanel({ publicId, startedAt }: SessionPanelProps) {
  return (
    <Card as="aside" className="session-panel">
      <Heading size="card">Sessão de gravação</Heading>
      <dl className="session-data">
        <div><dt>Registro</dt><dd>{publicId}</dd></div>
        <div><dt>Início</dt><dd>{startedAt}</dd></div>
      </dl>
      <Hint>Seus cliques e teclas são enviados ao navegador do servidor e ficam na trilha de auditoria. Nada é gravado a partir do seu computador.</Hint>
      <Notice>Se a conexão cair, a gravação é interrompida: o registro fica como FALHOU e o crédito é devolvido.</Notice>
    </Card>
  )
}
