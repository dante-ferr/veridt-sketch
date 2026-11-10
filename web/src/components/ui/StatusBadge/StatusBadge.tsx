import type { ReactNode } from 'react'

/**
 * Pill colored by state. `tone` is a capture or payment state (CONCLUIDO, PENDENTE, APROVADO…);
 * the colors live in styles/badges.css.
 */
export function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>
}
