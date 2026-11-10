import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Button, ButtonAnchor, Card, Heading, Hint, Text } from '@/components/ui'
import { ProviderDown } from '@/components/credits/ProviderDown'
import { Steps } from '@/components/credits/Steps'
import { PaymentStateBadge } from '@/components/credits/PaymentStateBadge'
import { notifyBalanceChanged } from '@/hooks/useCreditBalance'
import { useSession } from '@/hooks/useSession'
import { api, userMessage } from '@/services/api'
import type { OrderRow } from '@/types/credits'
import { formatBrl, formatRemaining } from '@/utils/format'
import './credits.css'

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
          if (body.state === 'APROVADO') notifyBalanceChanged()
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
    const tick = () => setLeft(formatRemaining(order.expiresAt))
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
      notifyBalanceChanged()
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
    <AppShell>
      <div className="credits-page payment-page">
        <Heading size="page" level="h2">Pagamento</Heading>
        <Steps current={3} />
        {error ? <p className="alert" role="alert">{error}</p> : null}
        {order ? (
          <>
            <div className="pay-tabs" role="tablist">
              <button className={tab === 'pix' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'pix'} onClick={() => setTab('pix')}>Pix na plataforma</button>
              <button className={tab === 'checkout' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'checkout'} onClick={() => setTab('checkout')}>Mercado Pago</button>
            </div>
            <div className="pay-grid">
              {tab === 'pix' ? (
                <Card className="pay-card">
                  <div className="qr">QR Code gerado pelo provedor de pagamento</div>
                  <div className="pix-content">
                    <div className="pix-status">
                      <PaymentStateBadge state={order.state} label={order.state === 'PENDENTE' ? 'Aguardando pagamento' : undefined} />
                      {order.state === 'PENDENTE' ? <span className="pix-expires">Expira em {left}</span> : null}
                    </div>
                    <Text>Abra o app do seu banco, escolha pagar com Pix e leia o QR Code, ou cole o código abaixo.</Text>
                    <div className="pix-box">
                      <div className="pix-box-head">
                        <strong>Pix copia e cola</strong>
                        <button className="pix-copy" type="button" onClick={() => void copyPix()}>{copied ? 'Copiado' : 'Copiar'}</button>
                      </div>
                      <p className="pix-code">{order.pixCopyPaste}</p>
                    </div>
                    <Hint>Os créditos entram no saldo assim que o provedor confirmar o pagamento. Você também receberá um e-mail de confirmação.</Hint>
                    {order.testConfirmation && order.state === 'PENDENTE' ? (
                      <Button className="pay-test" disabled={pending} onClick={() => void confirmTest()}>Confirmar pagamento de teste</Button>
                    ) : null}
                  </div>
                </Card>
              ) : (
                <Card className="pay-card checkout">
                  <div className="pix-content">
                    <div className="pix-status">
                      <PaymentStateBadge state={order.state} label={order.state === 'PENDENTE' ? 'Aguardando pagamento' : undefined} />
                    </div>
                    <Text>Você será levado ao checkout do Mercado Pago e voltará ao Veridt ao final. O saldo só muda depois da consulta ao provedor.</Text>
                    {order.testConfirmation && order.state === 'PENDENTE' ? (
                      <Button className="pay-test" disabled={pending} onClick={() => void confirmTest()}>Confirmar pagamento de teste</Button>
                    ) : null}
                  </div>
                </Card>
              )}
              <Card as="aside" className="billing-summary pay-summary">
                <Heading size="card" level="h3">Resumo</Heading>
                <div className="summary-line"><span>Pacote</span><strong>{order.packageName}</strong></div>
                <div className="summary-line"><span>Créditos</span><strong>{order.creditCount}</strong></div>
                <div className="summary-line total"><span>Total</span><strong>{formatBrl(order.totalCents)}</strong></div>
                <div className="pay-alternative">
                  <p className="pay-alternative-title">Prefere cartão ou saldo?</p>
                  <ButtonAnchor variant="outline" full href={order.checkoutUrl}>Pagar com Mercado Pago</ButtonAnchor>
                  <Hint>Você será levado ao checkout do Mercado Pago e voltará ao Veridt ao final.</Hint>
                </div>
              </Card>
            </div>
          </>
        ) : <p>Carregando o pedido.</p>}
        {error.includes('provedor') ? <ProviderDown /> : null}
      </div>
    </AppShell>
  )
}
