import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

// Helper to consume AuthContext in tests
function AuthConsumer({ onAuth }) {
  const auth = useAuth()
  onAuth?.(auth)
  return (
    <div>
      <span data-testid="ready">{String(auth.authReady)}</span>
      <span data-testid="enabled">{String(auth.authStatus.enabled)}</span>
      <span data-testid="bootstrap">{String(auth.authStatus.bootstrapNeeded)}</span>
      <span data-testid="user">{auth.authUser ? auth.authUser.username : 'none'}</span>
      <span data-testid="loading">{String(auth.authLoading)}</span>
      <span data-testid="error">{auth.authError || 'none'}</span>
    </div>
  )
}

function renderAuth(onAuth) {
  return render(
    <AuthProvider>
      <AuthConsumer onAuth={onAuth} />
    </AuthProvider>,
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('throws when useAuth is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })

  it('initializes with auth disabled and sets authReady', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ enabled: false, bootstrapNeeded: false }),
    })

    renderAuth()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })
    expect(screen.getByTestId('enabled').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('initializes with auth enabled and retrieves user from token', async () => {
    window.localStorage.setItem('cortex_token', 'test-token')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { username: 'admin', role: 'admin' } }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    renderAuth()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })
    expect(screen.getByTestId('enabled').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('admin')
  })

  it('clears token when /auth/me fails', async () => {
    window.localStorage.setItem('cortex_token', 'expired-token')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/me')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    renderAuth()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })
    expect(window.localStorage.getItem('cortex_token')).toBeNull()
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('handleLogin stores token and sets user on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/login') && opts?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ token: 'new-token', user: { username: 'bob', role: 'viewer' } }),
        }
      }
      if (url.includes('/auth/me')) {
        return { ok: false, status: 401, json: async () => ({}) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    let authRef
    renderAuth((auth) => { authRef = auth })

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })

    await act(async () => {
      await authRef.handleLogin('bob', 'password123')
    })

    expect(window.localStorage.getItem('cortex_token')).toBe('new-token')
    expect(screen.getByTestId('user').textContent).toBe('bob')
    expect(screen.getByTestId('error').textContent).toBe('none')
  })

  it('handleLogin sets error on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: false, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/login')) {
        return { ok: false, json: async () => ({ error: 'Invalid credentials' }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    let authRef
    renderAuth((auth) => { authRef = auth })

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })

    await act(async () => {
      await authRef.handleLogin('bad', 'wrong')
    })

    expect(screen.getByTestId('error').textContent).toBe('Invalid credentials')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('handleBootstrap stores token and clears bootstrapNeeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: true }) }
      }
      if (url.includes('/auth/bootstrap') && opts?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ token: 'bootstrap-token', user: { username: 'admin', role: 'admin' } }),
        }
      }
      if (url.includes('/auth/me')) {
        return { ok: false, status: 401, json: async () => ({}) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    let authRef
    renderAuth((auth) => { authRef = auth })

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })
    expect(screen.getByTestId('bootstrap').textContent).toBe('true')

    await act(async () => {
      await authRef.handleBootstrap('admin', 'secret')
    })

    expect(window.localStorage.getItem('cortex_token')).toBe('bootstrap-token')
    expect(screen.getByTestId('user').textContent).toBe('admin')
    expect(screen.getByTestId('bootstrap').textContent).toBe('false')
  })

  it('handleLogout clears token and user', async () => {
    window.localStorage.setItem('cortex_token', 'test-token')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { username: 'admin', role: 'admin' } }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    let authRef
    renderAuth((auth) => { authRef = auth })

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin')
    })

    act(() => {
      authRef.handleLogout()
    })

    expect(window.localStorage.getItem('cortex_token')).toBeNull()
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('updateAuthFromConfig disables auth and clears token', async () => {
    window.localStorage.setItem('cortex_token', 'test-token')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { username: 'admin', role: 'admin' } }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    let authRef
    renderAuth((auth) => { authRef = auth })

    await waitFor(() => {
      expect(screen.getByTestId('enabled').textContent).toBe('true')
    })

    act(() => {
      authRef.updateAuthFromConfig({ auth: { enabled: false } })
    })

    expect(screen.getByTestId('enabled').textContent).toBe('false')
    expect(window.localStorage.getItem('cortex_token')).toBeNull()
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('auth-expired event clears user and sets error', async () => {
    window.localStorage.setItem('cortex_token', 'test-token')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ enabled: true, bootstrapNeeded: false }) }
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { username: 'admin', role: 'admin' } }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    renderAuth()

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin')
    })

    act(() => {
      window.dispatchEvent(new CustomEvent('auth-expired'))
    })

    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('error').textContent).toContain('expired')
  })

  it('handles network error during initializeAuth gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderAuth()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true')
    })
    // Should still become ready even on error
    expect(screen.getByTestId('enabled').textContent).toBe('false')
    consoleSpy.mockRestore()
  })
})
