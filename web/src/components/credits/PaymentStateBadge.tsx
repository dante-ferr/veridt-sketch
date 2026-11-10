import { StateBadge } from '@/components/ui/StateBadge'
import type { PaymentState } from '@/types/credits'
import { paymentStateLabel } from '@/utils/paymentState'

/**
 * Order state pill with its Portuguese label ("● PENDENTE · Pendente").
 * `label` replaces the default label, e.g. "Aguardando pagamento" on the payment page.
 */
export function PaymentStateBadge({ state, label }: { state: PaymentState; label?: string }) {
  return <StateBadge state={state} label={label ?? paymentStateLabel[state]} />
}
