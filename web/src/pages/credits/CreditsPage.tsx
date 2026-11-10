import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Button, Card, Heading, Hint, Text } from '@/components/ui'
import { ProviderDown } from '@/components/credits/ProviderDown'
import { Steps } from '@/components/credits/Steps'
import { PaymentStateBadge } from '@/components/credits/PaymentStateBadge'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { OrderRow, PackageOffer } from '@/types/credits'
import { formatBrl, formatDateTimeUtc } from '@/utils/format'
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
      <div className="credits-page">
      <Heading size="page" level="h2">Comprar créditos</Heading>
      <Steps current={1} />
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {error.includes('provedor') ? <ProviderDown /> : null}
      <div className="packages">
        {items.map((item) => (
          <Card as="article" key={item.id} className={item.id === selected ? 'package selected' : 'package'}>
            <div className="package-head">
              <Heading size="card" level="h3">{item.name}</Heading>
              {item.id === selected ? <span className="selected-tag">Selecionado</span> : null}
            </div>
            <p className="credits-count">{item.creditCount} créditos</p>
            <Text muted>{formatBrl(item.pricePerCreditCents)} por crédito · total {formatBrl(item.totalCents)}</Text>
            <Text>{item.description}</Text>
            <Button full variant={item.id === selected ? 'primary' : 'outline'} onClick={() => {
              choose(item.id)
              navigate('/credits/billing')
            }}>
              {item.id === selected ? `Continuar com ${item.name}` : `Escolher ${item.name}`}
            </Button>
          </Card>
        ))}
      </div>
      <Hint>O preço fica congelado no momento da compra. Cada registro consome 1 crédito.</Hint>
      <Card className="history">
        <Heading size="card" level="h3">Histórico de compras</Heading>
        <table className="data-table">
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
                <td><Link className="state-link" to={`/credits/orders/${order.id}`}><PaymentStateBadge state={order.state} /></Link></td>
              </tr>
            ))}
            {orders.length === 0 ? <tr><td colSpan={5}>Nenhuma compra ainda.</td></tr> : null}
          </tbody>
        </table>
      </Card>
      {current ? null : null}
      </div>
    </AppShell>
  )
}
