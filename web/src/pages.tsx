import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, maskCpf, refreshStorageKey, userMessage } from './api'

type Profile = 'lawyer' | 'common_user'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>('/v1/sessions', {
        method: 'POST',
        body: { email, password },
      })
      sessionStorage.setItem(refreshStorageKey, tokens.refreshToken)
      sessionStorage.setItem('veridit.access', tokens.accessToken)
      navigate('/records')
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page">
      <h1>Veridit</h1>
      <p className="subtitle">Registro de evidências digitais com hash, data e hora verificáveis.</p>
      <form className="card" onSubmit={onSubmit}>
        <h2>Entrar</h2>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com.br" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div className="row">
          <Link to="/forgot-password">Esqueci minha senha</Link>
          <button className="primary" type="submit" disabled={pending}>Entrar</button>
        </div>
        <p className="note">Após 5 tentativas sem sucesso, o acesso fica bloqueado por alguns minutos.</p>
      </form>
      <p className="below">Ainda não tem conta? <Link to="/register">Cadastre-se</Link></p>
    </main>
  )
}

export function RegisterPage() {
  const [profile, setProfile] = useState<Profile>('lawyer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [oab, setOab] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== passwordConfirmation) {
      setPasswordError(true)
      return
    }
    setPasswordError(false)
    setPending(true)
    try {
      await api('/v1/accounts', {
        method: 'POST',
        body: {
          profile,
          fullName,
          email,
          cpf: cpf.replace(/\D/g, ''),
          oab: profile === 'lawyer' ? oab : undefined,
          password,
          passwordConfirmation,
          acceptedTerms,
        },
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
      <h1>Veridit</h1>
      <form className="card wide" onSubmit={onSubmit} style={{ marginTop: 28 }}>
        {done ? (
          <>
            <h2>Verifique seu e-mail</h2>
            <p>Enviamos um link de confirmação. Abra o e-mail e confirme antes de entrar.</p>
            <p className="below"><Link to="/">Ir para o login</Link></p>
          </>
        ) : (
          <>
            <h2>Criar conta</h2>
            {error ? <p className="alert" role="alert">{error}</p> : null}
            <p className="label">Tipo de conta</p>
            <div className="types">
              <label className={profile === 'lawyer' ? 'type selected' : 'type'}>
                <input type="radio" name="profile" checked={profile === 'lawyer'} onChange={() => setProfile('lawyer')} />
                <span>
                  <strong>Advogado</strong>
                  Informe o número da OAB.
                </span>
              </label>
              <label className={profile === 'common_user' ? 'type selected' : 'type'}>
                <input type="radio" name="profile" checked={profile === 'common_user'} onChange={() => setProfile('common_user')} />
                <span>
                  <strong>Usuário comum</strong>
                  Pessoa física, sem OAB.
                </span>
              </label>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="full-name">Nome completo</label>
              <input id="full-name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="register-email">E-mail</label>
              <input id="register-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com.br" />
              <p className="hint">Enviaremos um link de confirmação para este endereço.</p>
            </div>
            <div className="split">
              <div className="field">
                <label htmlFor="cpf">CPF</label>
                <input id="cpf" inputMode="numeric" required value={cpf} onChange={(event) => setCpf(maskCpf(event.target.value))} placeholder="000.000.000-00" />
                <p className="hint">Somente números.</p>
              </div>
              {profile === 'lawyer' ? (
                <div className="field">
                  <label htmlFor="oab">Número da OAB</label>
                  <input id="oab" required value={oab} onChange={(event) => setOab(event.target.value)} placeholder="UF 000000" />
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="new-password">Senha</label>
              <input id="new-password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
              <p className="hint">Mínimo de 8 caracteres.</p>
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirmar senha</label>
              <input id="confirm-password" className={passwordError ? 'invalid' : undefined} type="password" required value={passwordConfirmation} onChange={(event) => { setPasswordConfirmation(event.target.value); setPasswordError(false) }} />
              {passwordError ? <p className="error" role="alert">As senhas não conferem.</p> : null}
            </div>
            <label className="check">
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
              <span>Li e aceito os termos de uso e a política de privacidade.</span>
            </label>
            <div className="row">
              <Link to="/">Já tenho conta</Link>
              <button className="primary" type="submit" disabled={pending}>Criar conta</button>
            </div>
          </>
        )}
      </form>
      <p className="fine">Empresas poderão se cadastrar em uma próxima versão. Telefone e endereço são pedidos apenas na compra de créditos.</p>
    </main>
  )
}

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
      <h1>Veridit</h1>
      <div className="pair">
        <form className="card" onSubmit={onSubmit}>
          <h2>Recuperar senha</h2>
          <p>Informe o e-mail cadastrado. Enviaremos um link de uso único, válido por 30 minutos.</p>
          {error ? <p className="alert" role="alert">{error}</p> : null}
          <div className="field">
            <label htmlFor="recovery-email">E-mail cadastrado</label>
            <input id="recovery-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com.br" />
          </div>
          <div className="row">
            <Link to="/">Voltar ao login</Link>
            <button className="primary" type="submit" disabled={pending}>Enviar link</button>
          </div>
        </form>
        <section className="card">
          <h2>Verifique seu e-mail</h2>
          <p>Se houver uma conta com este e-mail, você receberá o link em alguns minutos.</p>
          <p className="note">Por segurança, a mensagem é a mesma quando o e-mail não está cadastrado. O link expira após o primeiro uso.</p>
          <button className="secondary" type="button" onClick={() => void onSubmit({ preventDefault() {} } as FormEvent)} disabled={pending || email.length === 0}>
            Reenviar link
          </button>
        </section>
      </div>
    </main>
  )
}

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
      <h1>Veridit</h1>
      <section className="card" style={{ marginTop: 28 }}>
        <h2>Confirmação de e-mail</h2>
        <p role="status" className={failed ? 'error' : undefined}>{message}</p>
        <p className="below"><Link to="/">Ir para o login</Link></p>
      </section>
    </main>
  )
}

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
      await api('/v1/password-resets', { method: 'POST', body: { token, password, passwordConfirmation } })
      setDone(true)
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page">
      <h1>Veridit</h1>
      <form className="card" style={{ marginTop: 28 }} onSubmit={onSubmit}>
        <h2>Nova senha</h2>
        {done ? (
          <p>Senha redefinida. Entre com a nova senha.</p>
        ) : (
          <>
            {error ? <p className="alert" role="alert">{error}</p> : null}
            <div className="field">
              <label htmlFor="reset-password">Senha</label>
              <input id="reset-password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
              <p className="hint">Mínimo de 8 caracteres.</p>
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirmar senha</label>
              <input id="reset-confirm" className={passwordError ? 'invalid' : undefined} type="password" required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
              {passwordError ? <p className="error">As senhas não conferem.</p> : null}
            </div>
            <button className="primary" type="submit" disabled={pending || token.length === 0}>Salvar senha</button>
          </>
        )}
        <p className="below"><Link to="/">Voltar ao login</Link></p>
      </form>
    </main>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem('veridit.access') ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const refreshToken = sessionStorage.getItem(refreshStorageKey)
    if (!refreshToken) {
      navigate('/')
      return
    }
    let cancelled = false
    api<{ accessToken: string }>('/v1/sessions/refresh', { method: 'POST', body: { refreshToken } })
      .then((tokens) => {
        if (cancelled) return
        sessionStorage.setItem('veridit.access', tokens.accessToken)
        setAccessToken(tokens.accessToken)
        return api<{ fullName: string }>('/v1/me', { token: tokens.accessToken })
      })
      .then((me) => {
        if (!cancelled && me) setFullName(me.fullName)
      })
      .catch(() => {
        if (cancelled) return
        sessionStorage.removeItem(refreshStorageKey)
        sessionStorage.removeItem('veridit.access')
        navigate('/')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  async function signOut() {
    const refreshToken = sessionStorage.getItem(refreshStorageKey)
    if (!refreshToken || !accessToken) return
    setPending(true)
    setError('')
    try {
      await api('/v1/sessions/logout', { method: 'POST', token: accessToken, body: { refreshToken } })
      sessionStorage.removeItem(refreshStorageKey)
      sessionStorage.removeItem('veridit.access')
      navigate('/')
    } catch (caught) {
      setError(userMessage(caught))
      setPending(false)
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>Veridit</h1>
        <button className="primary" type="button" onClick={() => void signOut()} disabled={pending}>Sair</button>
      </header>
      <section className="card">
        <h2>Você entrou</h2>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <p>{fullName ? `Olá, ${fullName}.` : 'Carregando a sessão.'}</p>
      </section>
    </main>
  )
}
