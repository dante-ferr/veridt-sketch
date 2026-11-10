import '@/pages/credits/credits.css'

/** Notice shown when the payment provider is unavailable. */
export function ProviderDown() {
  return (
    <div className="provider-down" role="alert">
      <strong>Pagamentos indisponíveis no momento.</strong> O provedor de pagamento não está respondendo. Seus registros e downloads continuam funcionando; tente comprar novamente em alguns minutos.
    </div>
  )
}
