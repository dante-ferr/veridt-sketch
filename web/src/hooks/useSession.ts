import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, refreshAccessToken, userMessage } from '@/services/api'
import {
  accessTokenExpired,
  getSnapshot,
  loseSession,
  onSessionLost,
  readAccessToken,
  readRefreshToken,
  setFullName,
  setSessionError,
  setSessionPending,
  subscribe,
} from '@/services/session-store'

export function useSession() {
  const navigate = useNavigate()
  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onSessionLost(() => {
      if (!cancelled) navigate('/')
    })
    if (!readRefreshToken()) {
      navigate('/')
      return () => {
        cancelled = true
        unsubscribe()
      }
    }
    const current = readAccessToken()
    const ready = current && !accessTokenExpired(current) ? Promise.resolve(current) : refreshAccessToken()
    ready
      .then((access) => {
        if (cancelled) return null
        return api<{ fullName: string }>('/v1/me', { token: access })
      })
      .then((me) => {
        if (!cancelled && me) setFullName(me.fullName)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) navigate('/')
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [navigate])

  async function signOut() {
    const refreshToken = readRefreshToken()
    const accessToken = getSnapshot().accessToken
    if (!refreshToken || !accessToken) {
      loseSession()
      return
    }
    setSessionPending(true)
    try {
      await api('/v1/sessions/logout', { method: 'POST', token: accessToken, body: { refreshToken } })
      loseSession()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        loseSession()
        return
      }
      setSessionError(userMessage(caught))
    }
  }

  return { ...session, signOut }
}
