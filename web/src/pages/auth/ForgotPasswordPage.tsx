import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthBrandLockup } from '@/components/auth/AuthBrandLockup'
import { api, userMessage } from '@/services/api'
import './auth.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await api('/v1/password-recoveries', { method: 'POST', body: { email } })
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page">
      <AuthBrandLockup />
      <div className="pair">
        <form className="card" onSubmit={onSubmit}>
          <h2>Recuperar senha</h2>
          <p>
            Informe o e-mail cadastrado. Enviaremos um link de uso único, válido
            por 30 minutos.
          </p>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="recovery-email">E-mail cadastrado</label>
            <input
              id="recovery-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com.br"
            />
          </div>
          <div className="row">
            <Link to="/">Voltar ao login</Link>
            <button className="primary" type="submit" disabled={pending}>
              Enviar link
            </button>
          </div>
        </form>
        <section className="card">
          <h2>Verifique seu e-mail</h2>
          <p>
            Se houver uma conta com este e-mail, você receberá o link em alguns
            minutos.
          </p>
          <p className="note">
            Por segurança, a mensagem é a mesma quando o e-mail não está
            cadastrado. O link expira após o primeiro uso.
          </p>
          <button
            className="secondary"
            type="button"
            onClick={() => void onSubmit({ preventDefault() {} } as FormEvent)}
            disabled={pending || email.length === 0}
          >
            Reenviar link
          </button>
        </section>
      </div>
    </main>
  )
}
