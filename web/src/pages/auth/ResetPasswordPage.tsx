import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthBrandLockup } from '@/components/auth/AuthBrandLockup'
import { api, userMessage } from '@/services/api'
import './auth.css'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState(token ? '' : 'Link inválido ou expirado.')
  const [passwordError, setPasswordError] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== passwordConfirmation) {
      setPasswordError(true)
      return
    }
    setPasswordError(false)
    setPending(true)
    try {
      await api('/v1/password-resets', {
        method: 'POST',
        body: { token, password, passwordConfirmation },
      })
      setDone(true)
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page">
      <AuthBrandLockup />
      <form className="card" style={{ marginTop: 28 }} onSubmit={onSubmit}>
        <h2>Nova senha</h2>
        {done ? (
          <p>Senha redefinida. Entre com a nova senha.</p>
        ) : (
          <>
            {error ? (
              <p className="alert" role="alert">
                {error}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="reset-password">Senha</label>
              <input
                id="reset-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="hint">Mínimo de 8 caracteres.</p>
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirmar senha</label>
              <input
                id="reset-confirm"
                className={passwordError ? 'invalid' : undefined}
                type="password"
                required
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
              />
              {passwordError ? (
                <p className="error">As senhas não conferem.</p>
              ) : null}
            </div>
            <button
              className="primary"
              type="submit"
              disabled={pending || token.length === 0}
            >
              Salvar senha
            </button>
          </>
        )}
        <p className="below">
          <Link to="/">Voltar ao login</Link>
        </p>
      </form>
    </main>
  )
}
