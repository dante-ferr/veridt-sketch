import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProviderDown } from '@/components/credits/ProviderDown'
import { Steps } from '@/components/credits/Steps'
import { DevExampleFill, loadDevSamples } from '@/components/dev/DevExampleFill'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { OrderRow, PackageOffer } from '@/types/credits'
import { maskCpf } from '@/utils/cpf'
import { formatBrl } from '@/utils/format'
import { packageKey } from './selectedPackage'
import './credits.css'

export function BillingPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [offer, setOffer] = useState<PackageOffer | null>(null)
  const [fullName, setFullName] = useState(session.fullName)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!session.accessToken) return
    if (session.fullName) setFullName((current) => current || session.fullName)
    const packageId = sessionStorage.getItem(packageKey)
    if (!packageId) {
      navigate('/credits')
      return
    }
    api<{ items: PackageOffer[] }>('/v1/credit-packages', { token: session.accessToken })
      .then((body) => setOffer(body.items.find((item) => item.id === packageId) ?? null))
      .catch((caught) => setError(userMessage(caught)))
    api<{ fullName: string; email: string }>('/v1/me', { token: session.accessToken })
      .then((me) => {
        setFullName((current) => current || me.fullName)
        setEmail((current) => current || me.email)
      })
      .catch(() => undefined)
  }, [session.accessToken, session.fullName, navigate])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!session.accessToken || !offer) return
    setPending(true)
    setError('')
    try {
      const order = await api<OrderRow>('/v1/credit-orders', {
        method: 'POST',
        token: session.accessToken,
        body: {
          packageId: offer.id,
          method: 'pix',
          billing: { fullName, email, phone, cpf, postalCode, street, number, complement, district, city, state },
        },
      })
      navigate(`/credits/orders/${order.id}`)
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function fillExample() {
    const samples = await loadDevSamples()
    if (!samples) return
    const sample = samples.billingSample()
    setFullName(sample.fullName)
    setEmail(sample.email)
    setPhone(sample.phone)
    setCpf(sample.cpf)
    setPostalCode(sample.postalCode)
    setStreet(sample.street)
    setNumber(sample.number)
    setComplement(sample.complement)
    setDistrict(sample.district)
    setCity(sample.city)
    setState(sample.state)
  }

  return (
    <AppShell>
      <h2>Dados de faturamento</h2>
      <Steps current={2} />
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {error.includes('provedor') ? <ProviderDown /> : null}
      <form className="billing-grid" onSubmit={(event) => void submit(event)}>
        <section className="panel">
          <h3>Comprador</h3>
          <label>Nome completo<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <div className="split">
            <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(71) 90000-0000" required /></label>
          </div>
          <label>CPF<input value={cpf} onChange={(event) => setCpf(maskCpf(event.target.value))} inputMode="numeric" required /></label>
          <h3>Endereço</h3>
          <div className="split">
            <label>CEP<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="00000-000" required /></label>
            <label>Endereço<input value={street} onChange={(event) => setStreet(event.target.value)} required /></label>
          </div>
          <div className="split">
            <label>Número<input value={number} onChange={(event) => setNumber(event.target.value)} required /></label>
            <label>Complemento<input value={complement} onChange={(event) => setComplement(event.target.value)} /></label>
          </div>
          <div className="split">
            <label>Bairro<input value={district} onChange={(event) => setDistrict(event.target.value)} required /></label>
            <label>Cidade<input value={city} onChange={(event) => setCity(event.target.value)} required /></label>
            <label>Estado<input value={state} onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))} required /></label>
          </div>
          <DevExampleFill onClick={() => void fillExample()} />
          <div className="row">
            <Link to="/credits">Trocar pacote</Link>
            <button className="primary" type="submit" disabled={pending || !offer}>Ir para o pagamento</button>
          </div>
        </section>
        <aside className="panel">
          <h3>Resumo</h3>
          {offer ? (
            <>
              <div className="summary-line"><span>Pacote</span><strong>{offer.name}</strong></div>
              <div className="summary-line"><span>Créditos</span><strong>{offer.creditCount}</strong></div>
              <div className="summary-line"><span>Valor por crédito</span><strong>{formatBrl(offer.pricePerCreditCents)}</strong></div>
              <div className="summary-line"><span>Total</span><strong>{formatBrl(offer.totalCents)}</strong></div>
            </>
          ) : <p>Escolha um pacote.</p>}
          <p className="hint">Telefone e endereço são usados só para o faturamento e ficam no serviço de pagamentos, separado do cadastro.</p>
        </aside>
      </form>
    </AppShell>
  )
}
