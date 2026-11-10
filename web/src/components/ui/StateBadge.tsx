/**
 * State pill: colored dot + mono code, and an optional " · label" ("● PENDENTE · Pendente").
 * `state` is a payment or capture state; colors live in styles/state-badge.css.
 */
export function StateBadge({ state, label }: { state: string; label?: string }) {
  return (
    <span className={`state-badge ${state}`}>
      <span className="state-badge-dot" aria-hidden="true" />
      <span className="state-badge-code">{state}</span>
      {label ? <span className="state-badge-label">· {label}</span> : null}
    </span>
  )
}
