import '@/pages/credits/credits.css'

const steps = ['Pacote', 'Faturamento', 'Pagamento'] as const

/** Purchase wizard progress: 1. Pacote, 2. Faturamento, 3. Pagamento. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <p className="wizard">
      {steps.map((name, index) => {
        const number = index + 1
        const status = number === current ? 'here' : number < current ? 'done' : 'todo'
        return (
          <span key={name} className={status} aria-current={status === 'here' ? 'step' : undefined}>
            {number}. {name}{status === 'done' ? ' ✓' : ''}
          </span>
        )
      })}
    </p>
  )
}
