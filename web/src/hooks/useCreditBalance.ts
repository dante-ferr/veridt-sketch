import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '@/services/api'

/** Event that pages dispatch on window to make the header reload the balance. */
export const balanceChangedEvent = 'veridit-balance'

/** Asks the header to reload the credit balance. */
export function notifyBalanceChanged(): void {
  window.dispatchEvent(new Event(balanceChangedEvent))
}

/** Balance label for the app header; reloads on navigation and on balanceChangedEvent. */
export function useCreditBalance(accessToken: string): string {
  const location = useLocation()
  const [balance, setBalance] = useState('Saldo …')
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const load = () => {
      api<{ available: number }>('/v1/credits/balance', { token: accessToken })
        .then((body) => {
          if (!cancelled) setBalance(`Saldo ${body.available} créditos`)
        })
        .catch(() => {
          if (!cancelled) setBalance('Saldo indisponível')
        })
    }
    load()
    window.addEventListener(balanceChangedEvent, load)
    return () => {
      cancelled = true
      window.removeEventListener(balanceChangedEvent, load)
    }
  }, [accessToken, location.pathname])
  return balance
}
