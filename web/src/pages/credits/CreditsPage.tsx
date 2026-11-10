import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProviderDown } from '@/components/credits/ProviderDown'
import { Steps } from '@/components/credits/Steps'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { OrderRow, PackageOffer } from '@/types/credits'
import { formatBrl, formatDateTimeUtc } from '@/utils/format'
import { paymentStateLabel } from '@/utils/paymentState'
import { packageKey } from './selectedPackage'
import './credits.css'

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
    <AppShell>
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
            {item.id === selected ? <StatusBadge tone="APROVADO">Selecionado</StatusBadge> : null}
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
                <td>{formatDateTimeUtc(order.createdAt)}</td>
                <td>{order.packageName}</td>
                <td>{order.creditCount}</td>
                <td>{order.method === 'pix' ? 'Pix' : 'Mercado Pago'}</td>
                <td><Link to={`/credits/orders/${order.id}`}><StatusBadge tone={order.state}>{order.state} · {paymentStateLabel[order.state]}</StatusBadge></Link></td>
              </tr>
            ))}
            {orders.length === 0 ? <tr><td colSpan={5}>Nenhuma compra ainda.</td></tr> : null}
          </tbody>
        </table>
      </section>
      {current ? null : null}
    </AppShell>
  )
}
