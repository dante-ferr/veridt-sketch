import type { PaymentState } from '@/types/credits'

/** Portuguese label for each credit order payment state. */
export const paymentStateLabel: Record<PaymentState, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  EXPIRADO: 'Expirado',
  ESTORNADO: 'Estornado',
}
