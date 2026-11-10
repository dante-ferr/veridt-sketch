import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthBrandLockup } from '@/components/auth/AuthBrandLockup'
import { api, userMessage } from '@/services/api'
import './auth.css'

export function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Confirmando o e-mail…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setFailed(true)
      setMessage('Link inválido ou expirado.')
      return
    }
    api('/v1/accounts/confirmation', { method: 'POST', body: { token } })
      .then(() => setMessage('E-mail confirmado. Você já pode entrar.'))
      .catch((error: unknown) => {
        setFailed(true)
        setMessage(userMessage(error))
      })
  }, [params])

  return (
    <main className="page">
      <AuthBrandLockup />
      <section className="card" style={{ marginTop: 28 }}>
        <h2>Confirmação de e-mail</h2>
        <p role="status" className={failed ? 'error' : undefined}>
          {message}
        </p>
        <p className="below">
          <Link to="/">Ir para o login</Link>
        </p>
      </section>
    </main>
  )
}
