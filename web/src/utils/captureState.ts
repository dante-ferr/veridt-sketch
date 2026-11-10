import type { CaptureKind, RecordState } from '@/types/capture'

/** Portuguese label for each record state. */
export const stateLabel: Record<RecordState, string> = {
  NA_FILA: 'Na fila',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
}

/** Color of a step status: done (ok), current (pending), waiting (muted). */
export type StepTone = 'done' | 'current' | 'waiting'

export type CaptureStep = {
  name: string
  status: string
  tone: StepTone
}

const done = (name: string): CaptureStep => ({ name, status: 'Feito', tone: 'done' })
const current = (name: string): CaptureStep => ({ name, status: 'Em andamento', tone: 'current' })
const waiting = (name: string, status = 'Aguardando'): CaptureStep => ({ name, status, tone: 'waiting' })

/** Progress list of a capture, from its state and kind. */
export function captureSteps(state: RecordState, kind: CaptureKind): CaptureStep[] {
  const credit = 'Crédito reservado'
  const queue = 'Na fila de captura'
  const running = kind === 'navigation_video' ? 'Gravando a navegação' : 'Abrindo o site e capturando a página'
  const sign = 'Cálculo dos hashes e assinatura do manifesto'
  const email = 'E-mail de conclusão'

  if (state === 'CANCELADO' || state === 'FALHOU') {
    const label = stateLabel[state]
    return [
      { name: credit, status: 'Devolvido', tone: 'done' },
      waiting(queue, label),
      waiting(running, label),
      waiting(sign, label),
      waiting(email, label),
    ]
  }
  const queued =
    kind === 'navigation_video'
      ? waiting(queue, 'Não se aplica ao vídeo')
      : state === 'NA_FILA'
        ? current(queue)
        : done(queue)
  return [
    done(credit),
    queued,
    state === 'NA_FILA' ? waiting(running) : state === 'EM_ANDAMENTO' ? current(running) : done(running),
    state === 'CONCLUIDO' ? done(sign) : waiting(sign),
    state === 'CONCLUIDO' ? done(email) : waiting(email),
  ]
}

const failureText: Array<[test: (reason: string) => boolean, text: string]> = [
  [(r) => r === 'page_load_failed', 'O site não respondeu dentro do tempo limite.'],
  [(r) => r === 'private_address', 'O endereço aponta para uma rede interna ou privada e foi bloqueado.'],
  [(r) => r === 'connection_lost', 'A conexão com a sessão de gravação foi perdida por mais de 30 segundos.'],
  [(r) => r === 'session_expired', 'A gravação passou do limite de 15 minutos sem ser concluída.'],
  [(r) => r === 'empty_video', 'O vídeo da gravação ficou vazio.'],
  [
    (r) => r.startsWith('manifest_') || r.startsWith('file_') || r === 'signature_invalid',
    'Os arquivos não passaram na conferência de integridade, e a prova não foi assinada.',
  ],
]

/** Message shown when a capture failed, for the failure reason code. */
export function failureMessage(reason: string | null): string {
  const refund = 'A captura falhou e 1 crédito foi devolvido ao seu saldo.'
  const cause = failureText.find(([test]) => reason !== null && test(reason))?.[1]
  return cause ? `${cause} ${refund}` : refund
}
