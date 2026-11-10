import type { ReactNode } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import './RecordingShell.css'

type RecordingShellProps = {
  /** Left side after the wordmark: record title, state badge, timer. */
  status: ReactNode
  /** Right side: Cancelar / Concluir gravação. */
  actions: ReactNode
  children: ReactNode
}

/** Full-screen layout of a live video recording: its own top bar instead of the app header. */
export function RecordingShell({ status, actions, children }: RecordingShellProps) {
  return (
    <div className="recording-shell">
      <header className="recording-bar">
        <div className="recording-bar-status">
          <Wordmark />
          {status}
        </div>
        <div className="recording-bar-actions">{actions}</div>
      </header>
      <main className="recording-main">{children}</main>
    </div>
  )
}
