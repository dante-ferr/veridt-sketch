import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Wordmark } from '@/components/brand/Wordmark'
import { useCreditBalance } from '@/hooks/useCreditBalance'
import { useSession } from '@/hooks/useSession'
import './AppShell.css'

/** Layout of the signed-in area: top bar with navigation, balance and sign-out. */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession()
  const balance = useCreditBalance(session.accessToken)
  return (
    <div className="shell">
      <header className="appbar">
        <div className="brand">
          <Link className="logo-link" to="/records"><Wordmark /></Link>
          <nav>
            <NavLink to="/records">Registros</NavLink>
            <NavLink to="/records/new">Novo registro</NavLink>
            <NavLink to="/credits">Créditos</NavLink>
            <NavLink to="/account">Minha conta</NavLink>
          </nav>
        </div>
        <div className="who">
          <span>{balance}</span>
          <span>{session.fullName || '…'}</span>
          <button className="secondary" type="button" onClick={() => void session.signOut()} disabled={session.pending}>Sair</button>
        </div>
      </header>
      {session.error ? <p className="alert" role="alert">{session.error}</p> : null}
      <div className="canvas">{children}</div>
    </div>
  )
}
