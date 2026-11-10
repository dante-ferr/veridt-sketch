import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, refreshStorageKey, userMessage } from './api'

export function useSession() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem('veridit.access') ?? '')
  const [fullName, setFullName] = useState('')
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

  return { accessToken, fullName, pending, error, signOut }
}
