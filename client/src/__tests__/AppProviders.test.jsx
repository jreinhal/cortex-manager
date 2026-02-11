import { render, screen, waitFor } from '@testing-library/react'
import { AppProviders } from '../AppProviders'
import { useAuth } from '../contexts/AuthContext'
import { useConfig } from '../contexts/ConfigContext'
import { useData } from '../contexts/DataContext'
import { useWorkspace } from '../contexts/WorkspaceContext'

// Mock apiFetch globally
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn().mockImplementation(async () => ({
    ok: true,
    json: async () => ([]),
  })),
}))

// A consumer that reads all 4 contexts to verify they're wired
function AllContextsConsumer() {
  const auth = useAuth()
  const config = useConfig()
  const data = useData()
  const workspace = useWorkspace()
  return (
    <div>
      <span data-testid="auth-ready">{String(auth.authReady)}</span>
      <span data-testid="auth-enabled">{String(auth.authStatus.enabled)}</span>
      <span data-testid="config-theme">{config.uiTheme}</span>
      <span data-testid="workspace-count">{workspace.workspaces.length}</span>
      <span data-testid="data-repo-count">{data.repos.length}</span>
    </div>
  )
}

describe('AppProviders', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()

    // Mock global fetch for auth init
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, bootstrapNeeded: false }),
    })
  })

  it('provides all 4 contexts to children', async () => {
    render(
      <AppProviders>
        <AllContextsConsumer />
      </AppProviders>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('true')
    })

    expect(screen.getByTestId('auth-enabled').textContent).toBe('false')
    expect(screen.getByTestId('config-theme').textContent).toBe('system')
    expect(screen.getByTestId('workspace-count').textContent).toBe('0')
    expect(screen.getByTestId('data-repo-count').textContent).toBe('0')
  })

  it('bridges auth state to ConfigProvider', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, bootstrapNeeded: false }),
    })

    // ConfigProvider should receive authReady=true after auth init
    render(
      <AppProviders>
        <AllContextsConsumer />
      </AppProviders>,
    )

    // Config should check itself after auth becomes ready
    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('true')
    })
  })

  it('renders children', async () => {
    render(
      <AppProviders>
        <div data-testid="child">Hello</div>
      </AppProviders>,
    )

    expect(screen.getByTestId('child').textContent).toBe('Hello')
  })
})
