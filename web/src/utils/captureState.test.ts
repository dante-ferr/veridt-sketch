import { describe, expect, it } from 'vitest'
import { captureSteps, failureMessage } from './captureState'

const statuses = (steps: ReturnType<typeof captureSteps>) => steps.map((step) => `${step.status}/${step.tone}`)

describe('captureSteps', () => {
  it('screenshot running: credit and queue done, capture current, rest waiting', () => {
    expect(statuses(captureSteps('EM_ANDAMENTO', 'screenshot'))).toEqual([
      'Feito/done',
      'Feito/done',
      'Em andamento/current',
      'Aguardando/waiting',
      'Aguardando/waiting',
    ])
  })

  it('screenshot queued: queue current', () => {
    expect(statuses(captureSteps('NA_FILA', 'screenshot')).slice(1, 3)).toEqual(['Em andamento/current', 'Aguardando/waiting'])
  })

  it('video has no queue', () => {
    const steps = captureSteps('EM_ANDAMENTO', 'navigation_video')
    expect(steps[1]?.status).toBe('Não se aplica ao vídeo')
    expect(steps[2]?.name).toBe('Gravando a navegação')
  })

  it('concluded: everything done', () => {
    expect(captureSteps('CONCLUIDO', 'screenshot').every((step) => step.tone === 'done')).toBe(true)
  })

  it('cancelled: credit returned, other steps cancelled', () => {
    expect(statuses(captureSteps('CANCELADO', 'screenshot'))).toEqual([
      'Devolvido/done',
      'Cancelado/waiting',
      'Cancelado/waiting',
      'Cancelado/waiting',
      'Cancelado/waiting',
    ])
  })
})

describe('failureMessage', () => {
  it('explains known reasons and the refund', () => {
    expect(failureMessage('page_load_failed')).toBe(
      'O site não respondeu dentro do tempo limite. A captura falhou e 1 crédito foi devolvido ao seu saldo.',
    )
    expect(failureMessage('connection_lost')).toContain('mais de 30 segundos')
    expect(failureMessage('manifest_hash_mismatch')).toContain('conferência de integridade')
    expect(failureMessage('file_missing')).toContain('conferência de integridade')
  })

  it('falls back for unknown reasons without repeating itself', () => {
    expect(failureMessage('something_new')).toBe('A captura falhou e 1 crédito foi devolvido ao seu saldo.')
    expect(failureMessage(null)).toBe('A captura falhou e 1 crédito foi devolvido ao seu saldo.')
  })
})
