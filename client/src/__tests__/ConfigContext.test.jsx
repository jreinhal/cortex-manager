import { render, screen, act, waitFor } from '@testing-library/react'
import { ConfigProvider, useConfig } from '../contexts/ConfigContext'

// Helper to consume ConfigContext in tests
function ConfigConsumer({ onConfig }) {
  const config = useConfig()
  onConfig?.(config)
  return (
    <div>
      <span data-testid="isFirstRun">{String(config.isFirstRun)}</span>
      <span data-testid="theme">{config.uiTheme}</span>
      <span data-testid="reposRoot">{config.appConfig?.config?.reposRoot || 'none'}</span>
      <span data-testid="defaultPaths">{JSON.stringify(config.defaultPaths)}</span>
    </div>
  )
}

function renderConfig(props = {}, onConfig) {
  const defaultProps = {
    authReady: true,
    authEnabled: false,
    authUser: null,
  }
  return render(
    <ConfigProvider {...defaultProps} {...props}>
      <ConfigConsumer onConfig={onConfig} />
    </ConfigProvider>,
  )
}

// Mock apiFetch
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

// Import after mock
import { apiFetch } from '../lib/api'

describe('ConfigContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    apiFetch.mockReset()
  })

  it('throws when useConfig is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ConfigConsumer />)).toThrow(
      'useConfig must be used within a ConfigProvider',
    )
    spy.mockRestore()
  })

  it('fetches config on mount when authReady and no auth required', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/config') {
        return {
          ok: true,
          json: async () => ({
            isFirstRun: false,
            config: { reposRoot: 'C:/repos', ui: { theme: 'dark' } },
          }),
        }
      }
      if (path === '/default-paths') {
        return {
          ok: true,
          json: async () => ({ home: 'C:/Users/test', repos: 'C:/repos' }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })

    renderConfig()

    await waitFor(() => {
      expect(screen.getByTestId('isFirstRun').textContent).toBe('false')
    })
    expect(screen.getByTestId('reposRoot').textContent).toBe('C:/repos')
    expect(screen.getByTestId('defaultPaths').textContent).toContain('C:/Users/test')
  })

  it('detects first run', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/config') {
        return {
          ok: true,
          json: async () => ({ isFirstRun: true, config: {} }),
        }
      }
      if (path === '/default-paths') {
        return {
          ok: true,
          json: async () => ({ home: 'C:/Users/test' }),
        }
      }
      return { ok: false, json: async () => ({}) }
    })

    renderConfig()

    await waitFor(() => {
      expect(screen.getByTestId('isFirstRun').textContent).toBe('true')
    })
  })

  it('does not fetch config when authReady is false', async () => {
    apiFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ isFirstRun: false, config: {} }),
    }))

    renderConfig({ authReady: false })

    // Give some time for any async ops
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(apiFetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('isFirstRun').textContent).toBe('null')
  })

  it('does not fetch config when auth enabled but no user', async () => {
    apiFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ isFirstRun: false, config: {} }),
    }))

    renderConfig({ authReady: true, authEnabled: true, authUser: null })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('fetches config when auth enabled and user present', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/config') {
        return {
          ok: true,
          json: async () => ({
            isFirstRun: false,
            config: { reposRoot: 'D:/repos' },
          }),
        }
      }
      if (path === '/default-paths') {
        return { ok: true, json: async () => ({}) }
      }
      return { ok: false, json: async () => ({}) }
    })

    renderConfig({
      authReady: true,
      authEnabled: true,
      authUser: { username: 'admin', role: 'admin' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('isFirstRun').textContent).toBe('false')
    })
    expect(screen.getByTestId('reposRoot').textContent).toBe('D:/repos')
  })

  it('handleSetupComplete sets isFirstRun to false and updates config', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/config') {
        return {
          ok: true,
          json: async () => ({ isFirstRun: true, config: {} }),
        }
      }
      if (path === '/default-paths') {
        return { ok: true, json: async () => ({}) }
      }
      return { ok: false, json: async () => ({}) }
    })

    let configRef
    renderConfig({}, (cfg) => { configRef = cfg })

    await waitFor(() => {
      expect(screen.getByTestId('isFirstRun').textContent).toBe('true')
    })

    act(() => {
      configRef.handleSetupComplete({ reposRoot: 'E:/myrepos' })
    })

    expect(screen.getByTestId('isFirstRun').textContent).toBe('false')
    expect(screen.getByTestId('reposRoot').textContent).toBe('E:/myrepos')
  })

  it('handleConfigSave updates appConfig', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/config') {
        return {
          ok: true,
          json: async () => ({
            isFirstRun: false,
            config: { reposRoot: 'C:/repos' },
          }),
        }
      }
      if (path === '/default-paths') {
        return { ok: true, json: async () => ({}) }
      }
      return { ok: false, json: async () => ({}) }
    })

    let configRef
    renderConfig({}, (cfg) => { configRef = cfg })

    await waitFor(() => {
      expect(screen.getByTestId('reposRoot').textContent).toBe('C:/repos')
    })

    act(() => {
      configRef.handleConfigSave({ reposRoot: 'D:/newrepos' })
    })

    expect(screen.getByTestId('reposRoot').textContent).toBe('D:/newrepos')
  })

  it('defaults to system theme when no stored preference', () => {
    renderConfig({ authReady: false })
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('uses stored theme preference from localStorage', () => {
    window.localStorage.setItem('cortex_theme', 'dark')
    renderConfig({ authReady: false })
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('handles config fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    apiFetch.mockRejectedValueOnce(new Error('Network error'))

    renderConfig()

    await waitFor(() => {
      expect(screen.getByTestId('isFirstRun').textContent).toBe('false')
    })
    consoleSpy.mockRestore()
  })
})
