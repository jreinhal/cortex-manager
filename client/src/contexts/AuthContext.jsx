import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE, AUTH_TOKEN_KEY } from '../lib/constants'
import { apiFetch } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authStatus, setAuthStatus] = useState({ enabled: false, bootstrapNeeded: false })
  const [authUser, setAuthUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const initializeAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/status`)
      const data = await res.json()
      setAuthStatus(data)
      if (!data.enabled) {
        setAuthReady(true)
        return
      }

      const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
      if (token) {
        const meRes = await apiFetch('/auth/me')
        if (meRes.ok) {
          const meData = await meRes.json()
          setAuthUser(meData.user || null)
        } else {
          window.localStorage.removeItem(AUTH_TOKEN_KEY)
        }
      }
    } catch (e) {
      console.error('Failed to initialize auth:', e)
    } finally {
      setAuthReady(true)
    }
  }, [])

  const handleLogin = useCallback(async (username, password) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, data.token)
        setAuthUser(data.user || null)
      } else {
        setAuthError(data?.error || 'Login failed.')
      }
    } catch (_e) {
      setAuthError('Login failed. Check server connectivity.')
    }
    setAuthLoading(false)
  }, [])

  const handleBootstrap = useCallback(async (username, password) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/auth/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, data.token)
        setAuthUser(data.user || null)
        setAuthStatus((prev) => ({ ...prev, bootstrapNeeded: false }))
      } else {
        setAuthError(data?.error || 'Bootstrap failed.')
      }
    } catch (_e) {
      setAuthError('Bootstrap failed. Check server connectivity.')
    }
    setAuthLoading(false)
  }, [])

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    setAuthUser(null)
  }, [])

  const updateAuthFromConfig = useCallback(
    (newConfig) => {
      const enabled = newConfig?.auth?.enabled === true
      setAuthStatus((prev) => ({ ...prev, enabled }))
      if (!enabled) {
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
        setAuthUser(null)
      } else {
        initializeAuth()
      }
    },
    [initializeAuth],
  )

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthUser(null)
      setAuthError('Session expired. Please sign in again.')
    }
    window.addEventListener('auth-expired', handleAuthExpired)
    return () => window.removeEventListener('auth-expired', handleAuthExpired)
  }, [])

  const value = {
    authStatus,
    authUser,
    authReady,
    authLoading,
    authError,
    handleLogin,
    handleBootstrap,
    handleLogout,
    updateAuthFromConfig,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
