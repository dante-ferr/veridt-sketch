import '@/pages/credits/credits.css'

/** Purchase wizard progress: 1. Pacote, 2. Faturamento, 3. Pagamento. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <p className="wizard">
      <span className={current === 1 ? 'here' : ''}>1. Pacote{current > 1 ? ' ✓' : ''}</span>
      {'  '}
      <span className={current === 2 ? 'here' : ''}>2. Faturamento{current > 2 ? ' ✓' : ''}</span>
      {'  '}
      <span className={current === 3 ? 'here' : ''}>3. Pagamento</span>
    </p>
  )
}
