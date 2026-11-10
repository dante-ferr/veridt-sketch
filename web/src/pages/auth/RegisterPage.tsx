import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthBrandLockup } from '@/components/auth/AuthBrandLockup'
import { DevExampleFill, loadDevSamples } from '@/components/dev/DevExampleFill'
import { api, userMessage } from '@/services/api'
import type { Profile } from '@/types/auth'
import { maskCpf } from '@/utils/cpf'
import './auth.css'

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

  async function fillExample() {
    const samples = await loadDevSamples()
    if (!samples) return
    const sample = samples.registrationSample(profile)
    setFullName(sample.fullName)
    setEmail(sample.email)
    setCpf(sample.cpf)
    setOab(sample.oab)
    setPassword(sample.password)
    setPasswordConfirmation(sample.password)
    setAcceptedTerms(true)
    setPasswordError(false)
  }

  return (
    <main className="page">
      <AuthBrandLockup />
      <form className="card wide" onSubmit={onSubmit} style={{ marginTop: 28 }}>
        {done ? (
          <>
            <h2>Verifique seu e-mail</h2>
            <p>
              Enviamos um link de confirmação. Abra o e-mail e confirme antes de
              entrar.
            </p>
            <p className="below">
              <Link to="/">Ir para o login</Link>
            </p>
          </>
        ) : (
          <>
            <h2>Criar conta</h2>
            {error ? (
              <p className="alert" role="alert">
                {error}
              </p>
            ) : null}
            <p className="label">Tipo de conta</p>
            <div className="types">
              <label
                className={profile === 'lawyer' ? 'type selected' : 'type'}
              >
                <input
                  type="radio"
                  name="profile"
                  checked={profile === 'lawyer'}
                  onChange={() => setProfile('lawyer')}
                />
                <span>
                  <strong>Advogado</strong>
                  Informe o número da OAB.
                </span>
              </label>
              <label
                className={profile === 'common_user' ? 'type selected' : 'type'}
              >
                <input
                  type="radio"
                  name="profile"
                  checked={profile === 'common_user'}
                  onChange={() => setProfile('common_user')}
                />
                <span>
                  <strong>Usuário comum</strong>
                  Pessoa física, sem OAB.
                </span>
              </label>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="full-name">Nome completo</label>
              <input
                id="full-name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="register-email">E-mail</label>
              <input
                id="register-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@exemplo.com.br"
              />
              <p className="hint">
                Enviaremos um link de confirmação para este endereço.
              </p>
            </div>
            <div className="split">
              <div className="field">
                <label htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  inputMode="numeric"
                  required
                  value={cpf}
                  onChange={(event) => setCpf(maskCpf(event.target.value))}
                  placeholder="000.000.000-00"
                />
                <p className="hint">Somente números.</p>
              </div>
              {profile === 'lawyer' ? (
                <div className="field">
                  <label htmlFor="oab">Número da OAB</label>
                  <input
                    id="oab"
                    required
                    value={oab}
                    onChange={(event) => setOab(event.target.value)}
                    placeholder="UF 000000"
                  />
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="new-password">Senha</label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="hint">Mínimo de 8 caracteres.</p>
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirmar senha</label>
              <input
                id="confirm-password"
                className={passwordError ? 'invalid' : undefined}
                type="password"
                required
                value={passwordConfirmation}
                onChange={(event) => {
                  setPasswordConfirmation(event.target.value)
                  setPasswordError(false)
                }}
              />
              {passwordError ? (
                <p className="error" role="alert">
                  As senhas não conferem.
                </p>
              ) : null}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Li e aceito os termos de uso e a política de privacidade.
              </span>
            </label>
            <DevExampleFill onClick={() => void fillExample()} />
            <div className="row">
              <Link to="/">Já tenho conta</Link>
              <button className="primary" type="submit" disabled={pending}>
                Criar conta
              </button>
            </div>
          </>
        )}
      </form>
      <p className="fine">
        Empresas poderão se cadastrar em uma próxima versão. Telefone e endereço
        são pedidos apenas na compra de créditos.
      </p>
    </main>
  )
}
