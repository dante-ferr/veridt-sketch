import type { EmailEvent } from '@veridit/events'

export type OutboundEmail = {
  to: string
  subject: string
  text: string
}

export function buildMessage(event: EmailEvent, origin: string): OutboundEmail {
  if (event.type === 'ConfirmacaoEmailSolicitada') {
    const link = new URL('/confirm', origin)
    link.searchParams.set('token', event.data.token)
    return {
      to: event.data.email,
      subject: 'Confirme seu e-mail no Veridit',
      text: [
        `Olá, ${event.data.fullName}.`,
        '',
        'Confirme seu e-mail para entrar no Veridit. O link é de uso único e vale 24 horas.',
        '',
        link.toString(),
      ].join('\n'),
    }
  }
  if (event.type === 'CapturaConcluida') return completionMessage(event)
  const link = new URL('/reset-password', origin)
  link.searchParams.set('token', event.data.token)
  return {
    to: event.data.email,
    subject: 'Redefina sua senha no Veridit',
    text: [
      `Olá, ${event.data.fullName}.`,
      '',
      'Recebemos um pedido para redefinir sua senha. O link é de uso único e vale 30 minutos.',
      'Se você não pediu, ignore esta mensagem.',
      '',
      link.toString(),
    ].join('\n'),
  }
}

export function completionMessage(event: Extract<EmailEvent, { type: 'CapturaConcluida' }>): OutboundEmail {
  return {
    to: event.data.email,
    subject: 'Captura concluída no Veridit',
    text: [
      `Olá, ${event.data.fullName}.`,
      '',
      `A captura "${event.data.title}" foi concluída.`,
      `Registro: ${event.data.publicId}.`,
      '',
      `Hash do manifesto (SHA-256): ${event.data.manifestHash}`,
      '',
      'Guarde esta mensagem. O hash permite conferir o manifesto fora do Veridit.',
    ].join('\n'),
  }
}
