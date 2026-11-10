import type { RecordState } from '@/types/capture'

/** Portuguese label for each record state. */
export const stateLabel: Record<RecordState, string> = {
  NA_FILA: 'Na fila',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
}

/** Status text of one step of the capture progress list, given the record state. */
export function step(state: RecordState, name: 'queued' | 'running' | 'sign'): string {
  if (state === 'FALHOU' || state === 'CANCELADO') return stateLabel[state]
  if (name === 'queued') return state === 'NA_FILA' ? 'Em andamento' : 'Feito'
  if (name === 'running') return state === 'EM_ANDAMENTO' ? 'Em andamento' : state === 'CONCLUIDO' ? 'Feito' : 'Aguardando'
  return state === 'CONCLUIDO' ? 'Feito' : 'Aguardando'
}
