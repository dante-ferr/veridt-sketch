import { Wordmark } from '@/components/brand/Wordmark'
import { useSession } from '@/hooks/useSession'
import './auth/auth.css'

export function HomePage() {
  const session = useSession()

  return (
    <main className="page">
      <header className="topbar">
        <h1 className="brand-lockup">
          <Wordmark />
        </h1>
        <button
          className="primary"
          type="button"
          onClick={() => void session.signOut()}
          disabled={session.pending}
        >
          Sair
        </button>
      </header>
      <section className="card">
        <h2>Você entrou</h2>
        {session.error ? (
          <p className="alert" role="alert">
            {session.error}
          </p>
        ) : null}
        <p>
          {session.fullName
            ? `Olá, ${session.fullName}.`
            : 'Carregando a sessão.'}
        </p>
      </section>
    </main>
  )
}
