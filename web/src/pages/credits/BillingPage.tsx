import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ActionRow, Button, Card, Field, Heading, Hint, Input, TextLink } from '@/components/ui'
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
      <div className="credits-page">
      <Heading size="page" level="h2">Dados de faturamento</Heading>
      <Steps current={2} />
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {error.includes('provedor') ? <ProviderDown /> : null}
      <form className="billing-grid" onSubmit={(event) => void submit(event)}>
        <Card className="billing-form">
          <Heading size="card" level="h3">Comprador</Heading>
          <Field label="Nome completo" htmlFor="billing-full-name"><Input id="billing-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ana Ribeiro" required /></Field>
          <div className="split cols-2">
            <Field label="E-mail" htmlFor="billing-email"><Input id="billing-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com.br" required /></Field>
            <Field label="Telefone" htmlFor="billing-phone"><Input id="billing-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(71) 90000-0000" required /></Field>
          </div>
          <Field label="CPF" htmlFor="billing-cpf"><Input id="billing-cpf" value={cpf} onChange={(event) => setCpf(maskCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required /></Field>
          <Heading size="card" level="h3">Endereço</Heading>
          <div className="split narrow-first">
            <Field label="CEP" htmlFor="billing-postal-code" hint="Preenche o endereço."><Input id="billing-postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="00000-000" required /></Field>
            <Field label="Endereço" htmlFor="billing-street"><Input id="billing-street" value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Rua, avenida" required /></Field>
          </div>
          <div className="split narrow-first">
            <Field label="Número" htmlFor="billing-number"><Input id="billing-number" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="000" required /></Field>
            <Field label="Complemento" htmlFor="billing-complement" hint="Opcional."><Input id="billing-complement" value={complement} onChange={(event) => setComplement(event.target.value)} placeholder="Apto, sala" /></Field>
          </div>
          <div className="split cols-3">
            <Field label="Bairro" htmlFor="billing-district"><Input id="billing-district" value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="Bairro" required /></Field>
            <Field label="Cidade" htmlFor="billing-city"><Input id="billing-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Salvador" required /></Field>
            <Field label="Estado" htmlFor="billing-state"><Input id="billing-state" value={state} onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" required /></Field>
          </div>
          <DevExampleFill onClick={() => void fillExample()} />
          <ActionRow divided>
            <TextLink size="sm" to="/credits">← Trocar pacote</TextLink>
            <Button type="submit" disabled={pending || !offer}>Ir para o pagamento</Button>
          </ActionRow>
        </Card>
        <Card as="aside" className="billing-summary">
          <Heading size="card" level="h3">Resumo</Heading>
          {offer ? (
            <>
              <div className="summary-line"><span>Pacote</span><strong>{offer.name}</strong></div>
              <div className="summary-line"><span>Créditos</span><strong>{offer.creditCount}</strong></div>
              <div className="summary-line"><span>Valor por crédito</span><strong>{formatBrl(offer.pricePerCreditCents)}</strong></div>
              <div className="summary-line total"><span>Total</span><strong>{formatBrl(offer.totalCents)}</strong></div>
            </>
          ) : <p>Escolha um pacote.</p>}
          <Hint>Telefone e endereço são usados só para o faturamento e ficam no serviço de pagamentos, separado do cadastro.</Hint>
        </Card>
      </form>
      </div>
    </AppShell>
  )
}
