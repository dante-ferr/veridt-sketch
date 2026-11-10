import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, maskCpf, userMessage } from './api'
import { Shell } from './evidence'
import { useSession } from './session'

type PackageOffer = {
  id: string
  code: string
  name: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
  description: string
}

type OrderRow = {
  id: string
  packageName: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
  method: 'pix' | 'checkout'
  state: 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO' | 'ESTORNADO'
  pixCopyPaste: string
  checkoutUrl: string
  expiresAt: string
  createdAt: string
  testConfirmation: boolean
}

const packageKey = 'veridit.packageId'

const stateLabel: Record<OrderRow['state'], string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  EXPIRADO: 'Expirado',
  ESTORNADO: 'Estornado',
}

export function CreditsPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [items, setItems] = useState<PackageOffer[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [selected, setSelected] = useState(sessionStorage.getItem(packageKey) ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session.accessToken) return
    api<{ items: PackageOffer[] }>('/v1/credit-packages', { token: session.accessToken })
      .then((body) => {
        setItems(body.items)
        const stored = sessionStorage.getItem(packageKey)
        const match = body.items.find((item) => item.id === stored) ?? body.items.find((item) => item.code === 'standard') ?? body.items[0]
        if (match) {
          setSelected(match.id)
          sessionStorage.setItem(packageKey, match.id)
        }
      })
      .catch((caught) => setError(userMessage(caught)))
    api<{ items: OrderRow[] }>('/v1/credit-orders', { token: session.accessToken })
      .then((body) => setOrders(body.items))
      .catch(() => setOrders([]))
  }, [session.accessToken])

  function choose(id: string) {
    setSelected(id)
    sessionStorage.setItem(packageKey, id)
  }

  const current = items.find((item) => item.id === selected)

  return (
    <Shell>
      <h2>Comprar créditos</h2>
      <Steps current={1} />
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {error.includes('provedor') ? <ProviderDown /> : null}
      <div className="packages">
        {items.map((item) => (
          <article key={item.id} className={item.id === selected ? 'package selected' : 'package'}>
            <h3>{item.name}</h3>
            <p className="credits-count">{item.creditCount} créditos</p>
            <p className="hint">{formatBrl(item.pricePerCreditCents)} por crédito · total {formatBrl(item.totalCents)}</p>
            <p>{item.description}</p>
            {item.id === selected ? <span className="badge APROVADO">Selecionado</span> : null}
            <button className={item.id === selected ? 'primary' : 'secondary'} type="button" onClick={() => {
              choose(item.id)
              navigate('/credits/billing')
            }}>
              {item.id === selected ? `Continuar com ${item.name}` : `Escolher ${item.name}`}
            </button>
          </article>
        ))}
      </div>
      <p className="hint">O preço fica congelado no momento da compra. Cada registro consome 1 crédito.</p>
      <section className="panel">
        <h3>Histórico de compras</h3>
        <table className="grid">
          <thead>
            <tr><th>Data (UTC)</th><th>Pacote</th><th>Créditos</th><th>Forma</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{formatUtc(order.createdAt)}</td>
                <td>{order.packageName}</td>
                <td>{order.creditCount}</td>
                <td>{order.method === 'pix' ? 'Pix' : 'Mercado Pago'}</td>
                <td><Link to={`/credits/orders/${order.id}`}><span className={`badge ${order.state}`}>{order.state} · {stateLabel[order.state]}</span></Link></td>
              </tr>
            ))}
            {orders.length === 0 ? <tr><td colSpan={5}>Nenhuma compra ainda.</td></tr> : null}
          </tbody>
        </table>
      </section>
      {current ? null : null}
    </Shell>
  )
}

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

  return (
    <Shell>
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
    </Shell>
  )
}

export function PaymentPage() {
  const session = useSession()
  const { id = '' } = useParams()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [tab, setTab] = useState<'pix' | 'checkout'>('pix')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [left, setLeft] = useState('')

  useEffect(() => {
    if (!session.accessToken || !id) return
    let cancelled = false
    const load = () => {
      api<OrderRow>(`/v1/credit-orders/${id}`, { token: session.accessToken })
        .then((body) => {
          if (cancelled) return
          setOrder(body)
          setTab(body.method === 'checkout' ? 'checkout' : 'pix')
          if (body.state === 'APROVADO') window.dispatchEvent(new Event('veridit-balance'))
        })
        .catch((caught) => {
          if (!cancelled) setError(userMessage(caught))
        })
    }
    load()
    const timer = window.setInterval(load, 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [session.accessToken, id])

  useEffect(() => {
    if (!order) return
    const tick = () => setLeft(remaining(order.expiresAt))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [order])

  async function confirmTest() {
    if (!session.accessToken || !order) return
    setPending(true)
    setError('')
    try {
      const body = await api<OrderRow>(`/v1/credit-orders/${order.id}/test-payment`, {
        method: 'POST',
        token: session.accessToken,
      })
      setOrder(body)
      window.dispatchEvent(new Event('veridit-balance'))
    } catch (caught) {
      setError(userMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function copyPix() {
    if (!order) return
    await navigator.clipboard.writeText(order.pixCopyPaste).catch(() => undefined)
    setCopied(true)
  }

  return (
    <Shell>
      <h2>Pagamento</h2>
      <Steps current={3} />
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {error.includes('provedor') ? <ProviderDown /> : null}
      {order ? (
        <div className="pay-grid">
          <section className="panel">
            <div className="tabs">
              <button className={tab === 'pix' ? 'active' : ''} type="button" onClick={() => setTab('pix')}>Pix na plataforma</button>
              <button className={tab === 'checkout' ? 'active' : ''} type="button" onClick={() => setTab('checkout')}>Mercado Pago</button>
            </div>
            {tab === 'pix' ? (
              <>
                <p><span className={`badge ${order.state}`}>{order.state} · {order.state === 'PENDENTE' ? 'Aguardando pagamento' : stateLabel[order.state]}</span> {order.state === 'PENDENTE' ? <span> Expira em {left}</span> : null}</p>
                <div className="pix-row">
                  <div className="qr">QR Code gerado pelo provedor de pagamento</div>
                  <div>
                    <p>Abra o app do seu banco, escolha pagar com Pix e leia o QR Code, ou cole o código abaixo.</p>
                    <div className="pix-box">
                      <div className="row">
                        <strong>Pix copia e cola</strong>
                        <button className="secondary" type="button" onClick={() => void copyPix()}>{copied ? 'Copiado' : 'Copiar'}</button>
                      </div>
                      <p>{order.pixCopyPaste}</p>
                    </div>
                  </div>
                </div>
                <p className="hint">Os créditos entram no saldo assim que o provedor confirmar o pagamento. Você também receberá um e-mail de confirmação.</p>
                {order.testConfirmation && order.state === 'PENDENTE' ? (
                  <button className="primary" type="button" disabled={pending} onClick={() => void confirmTest()}>Confirmar pagamento de teste</button>
                ) : null}
              </>
            ) : (
              <>
                <p>Você será levado ao checkout do Mercado Pago e voltará ao Veridit ao final. O saldo só muda depois da consulta ao provedor.</p>
                <p><a className="button" href={order.checkoutUrl}>Pagar com Mercado Pago</a></p>
                {order.testConfirmation && order.state === 'PENDENTE' ? (
                  <button className="secondary" type="button" disabled={pending} onClick={() => void confirmTest()}>Confirmar pagamento de teste</button>
                ) : null}
              </>
            )}
          </section>
          <aside className="panel">
            <h3>Resumo</h3>
            <div className="summary-line"><span>Pacote</span><strong>{order.packageName}</strong></div>
            <div className="summary-line"><span>Créditos</span><strong>{order.creditCount}</strong></div>
            <div className="summary-line"><span>Total</span><strong>{formatBrl(order.totalCents)}</strong></div>
          </aside>
        </div>
      ) : <p>Carregando o pedido.</p>}
    </Shell>
  )
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <p className="wizard">
      <span className={current === 1 ? 'here' : ''}>1. Pacote{current > 1 ? ' ✓' : ''}</span>
      {'  '}
      <span className={current === 2 ? 'here' : ''}>2. Faturamento{current > 2 ? ' ✓' : ''}</span>
      {'  '}
      <span className={current === 3 ? 'here' : ''}>3. Pagamento</span>
    </p>
  )
}

function ProviderDown() {
  return (
    <div className="provider-down" role="alert">
      <strong>Pagamentos indisponíveis no momento.</strong> O provedor de pagamento não está respondendo. Seus registros e downloads continuam funcionando; tente comprar novamente em alguns minutos.
    </div>
  )
}

function formatBrl(cents: number): string {
  const reais = Math.floor(cents / 100).toLocaleString('pt-BR')
  const fraction = String(Math.abs(cents) % 100).padStart(2, '0')
  return `R$ ${reais},${fraction}`
}

function formatUtc(value: string): string {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

function remaining(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now()
  if (ms <= 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
