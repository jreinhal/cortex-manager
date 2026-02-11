import { render, screen, act, waitFor } from '@testing-library/react'
import { DataProvider, useData } from '../contexts/DataContext'

// Mock apiFetch
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '../lib/api'

function DataConsumer({ onData }) {
  const data = useData()
  onData?.(data)
  return (
    <div>
      <span data-testid="repoCount">{data.repos.length}</span>
      <span data-testid="categoryCount">{data.categories.length}</span>
      <span data-testid="runCount">{data.runs.length}</span>
      <span data-testid="datasetCount">{data.datasets.length}</span>
      <span data-testid="evalCount">{data.evaluations.length}</span>
      <span data-testid="jobCount">{data.jobs.length}</span>
      <span data-testid="promptCount">{data.savedPrompts.length}</span>
      <span data-testid="userCount">{data.users.length}</span>
      <span data-testid="sessionCount">{data.sessions.length}</span>
      <span data-testid="logCount">{data.logs.length}</span>
      <span data-testid="url">{data.url}</span>
      <span data-testid="repoLoading">{String(data.repoLoading)}</span>
      <span data-testid="loading">{String(data.loading)}</span>
      <span data-testid="spawnResult">{data.spawnResult || 'none'}</span>
    </div>
  )
}

function renderData(props = {}, onData) {
  const defaultProps = {
    isFirstRun: false,
    authEnabled: false,
    authUser: null,
  }
  return render(
    <DataProvider {...defaultProps} {...props}>
      <DataConsumer onData={onData} />
    </DataProvider>,
  )
}

// Helper to create a mock successful fetch response
function mockOk(data) {
  return { ok: true, json: async () => data }
}

describe('DataContext', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.restoreAllMocks()
    window.localStorage.clear()
    apiFetch.mockReset()
    // Default: all API calls return empty arrays/objects
    apiFetch.mockImplementation(async () => mockOk([]))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when useData is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<DataConsumer />)).toThrow(
      'useData must be used within a DataProvider',
    )
    spy.mockRestore()
  })

  it('initializes with empty state', () => {
    renderData({ isFirstRun: true })
    expect(screen.getByTestId('repoCount').textContent).toBe('0')
    expect(screen.getByTestId('runCount').textContent).toBe('0')
    expect(screen.getByTestId('datasetCount').textContent).toBe('0')
    expect(screen.getByTestId('url').textContent).toBe('')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('does not fetch data when isFirstRun is true', async () => {
    renderData({ isFirstRun: true })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('fetches data when isFirstRun becomes false', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/repos') return mockOk([{ Name: 'test-repo', Path: '/repos/test-repo' }])
      if (path === '/categories') return mockOk(['AI', 'Web'])
      if (path === '/runs') return mockOk([{ id: 'run-1' }])
      if (path === '/sessions') return mockOk([])
      if (path === '/datasets') return mockOk([])
      if (path === '/evaluations') return mockOk([])
      if (path === '/agents') return mockOk([])
      if (path === '/tools') return mockOk([])
      if (path === '/prompts') return mockOk([])
      if (path === '/evaluation-templates') return mockOk([])
      if (path === '/jobs') return mockOk([])
      if (path === '/observability/summary') return mockOk({})
      if (path === '/vector-index/status') return mockOk({})
      if (path === '/audit?limit=200') return mockOk([])
      if (path === '/external-skills/installed') return mockOk({ installed: [] })
      if (path === '/category-sizes') return mockOk({})
      return mockOk([])
    })

    renderData({ isFirstRun: false })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    await waitFor(() => {
      expect(screen.getByTestId('repoCount').textContent).toBe('1')
    })
    expect(screen.getByTestId('categoryCount').textContent).toBe('2')
    expect(screen.getByTestId('runCount').textContent).toBe('1')
  })

  it('addLog prepends timestamped entries', () => {
    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    act(() => {
      dataRef.addLog('Test message 1')
      dataRef.addLog('Test message 2')
    })

    expect(screen.getByTestId('logCount').textContent).toBe('2')
  })

  it('addLog caps at 200 entries', () => {
    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    act(() => {
      for (let i = 0; i < 210; i++) {
        dataRef.addLog(`Log ${i}`)
      }
    })

    expect(Number(screen.getByTestId('logCount').textContent)).toBeLessThanOrEqual(200)
  })

  it('savePrompt calls API and updates state on success', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/prompts' && opts?.method === 'POST') {
        return mockOk({ success: true, prompt: { id: 'p-1', title: 'Test', query: 'hello' } })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    let result
    await act(async () => {
      result = await dataRef.savePrompt('Test', 'hello')
    })

    expect(result).toEqual({ id: 'p-1', title: 'Test', query: 'hello' })
    expect(screen.getByTestId('promptCount').textContent).toBe('1')
  })

  it('savePrompt returns null for empty query', async () => {
    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    let result
    await act(async () => {
      result = await dataRef.savePrompt('Title', '')
    })

    expect(result).toBeNull()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('deletePrompt removes from state on success', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/prompts' && opts?.method === 'POST') {
        return mockOk({ success: true, prompt: { id: 'p-1', title: 'Test', query: 'hello' } })
      }
      if (path === '/prompts/p-1' && opts?.method === 'DELETE') {
        return mockOk({ success: true })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.savePrompt('Test', 'hello')
    })
    expect(screen.getByTestId('promptCount').textContent).toBe('1')

    let result
    await act(async () => {
      result = await dataRef.deletePrompt('p-1')
    })

    expect(result).toBe(true)
    expect(screen.getByTestId('promptCount').textContent).toBe('0')
  })

  it('createDataset calls API and updates state', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/datasets' && opts?.method === 'POST') {
        return mockOk({
          success: true,
          dataset: { id: 'ds-1', name: 'Test DS', description: 'desc' },
        })
      }
      if (path === '/evaluations') return mockOk([])
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    let result
    await act(async () => {
      result = await dataRef.createDataset('Test DS', 'desc')
    })

    expect(result).toMatchObject({ id: 'ds-1', name: 'Test DS' })
    expect(screen.getByTestId('datasetCount').textContent).toBe('1')
  })

  it('deleteDataset removes from state', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/datasets' && opts?.method === 'POST') {
        return mockOk({ success: true, dataset: { id: 'ds-1', name: 'Test' } })
      }
      if (path === '/datasets/ds-1' && opts?.method === 'DELETE') {
        return mockOk({ success: true })
      }
      if (path === '/evaluations') return mockOk([])
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.createDataset('Test', 'desc')
    })
    expect(screen.getByTestId('datasetCount').textContent).toBe('1')

    await act(async () => {
      await dataRef.deleteDataset('ds-1')
    })
    expect(screen.getByTestId('datasetCount').textContent).toBe('0')
  })

  it('handleScan calls API and triggers fetchData', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/scan' && opts?.method === 'POST') {
        return mockOk({ output: 'Found 5 repos' })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.handleScan()
    })

    expect(apiFetch).toHaveBeenCalledWith('/scan', { method: 'POST' })
    expect(screen.getByTestId('repoLoading').textContent).toBe('false')
  })

  it('handleAdd validates URL and calls API', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/add' && opts?.method === 'POST') {
        return mockOk({ success: true, output: 'Cloned successfully' })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    act(() => { dataRef.setUrl('https://github.com/user/repo.git') })

    await act(async () => {
      await dataRef.handleAdd()
    })

    expect(apiFetch).toHaveBeenCalledWith('/add', expect.objectContaining({ method: 'POST' }))
    expect(screen.getByTestId('repoLoading').textContent).toBe('false')
  })

  it('handleAdd does nothing with empty URL', async () => {
    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.handleAdd()
    })

    // Should not have been called with /add
    expect(apiFetch).not.toHaveBeenCalledWith('/add', expect.anything())
  })

  it('handleSpawn calls API and stores result', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/spawn' && opts?.method === 'POST') {
        return mockOk({ success: true, output: '## Flight Plan\nStep 1...' })
      }
      if (path === '/sessions' && opts?.method === 'POST') {
        return mockOk({ success: true })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.handleSpawn('Build a CLI tool', 'universal', false)
    })

    expect(screen.getByTestId('spawnResult').textContent).toContain('Flight Plan')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('handleSpawn handles queued job', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/spawn' && opts?.method === 'POST') {
        return mockOk({ success: true, queued: true, job: { id: 'j-1' } })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.handleSpawn('Build a CLI tool', 'universal', true)
    })

    expect(screen.getByTestId('spawnResult').textContent).toContain('j-1')
  })

  it('setWorkspaceFetcher wires workspace fetch into fetchData', async () => {
    const mockWorkspaceFetch = vi.fn()

    apiFetch.mockImplementation(async () => mockOk([]))

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    act(() => {
      dataRef.setWorkspaceFetcher(mockWorkspaceFetch)
    })

    await act(async () => {
      dataRef.fetchData()
    })

    expect(mockWorkspaceFetch).toHaveBeenCalled()
  })

  it('cancelJob calls API and refreshes jobs', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/jobs/j-1/cancel' && opts?.method === 'POST') {
        return mockOk({ success: true })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.cancelJob('j-1')
    })

    expect(apiFetch).toHaveBeenCalledWith('/jobs/j-1/cancel', { method: 'POST' })
  })

  it('createUser calls API and refreshes users', async () => {
    apiFetch.mockImplementation(async (path, opts) => {
      if (path === '/users' && opts?.method === 'POST') {
        return mockOk({ success: true })
      }
      if (path === '/users') return mockOk([{ id: 'u-1', username: 'newuser' }])
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: true }, (d) => { dataRef = d })

    await act(async () => {
      await dataRef.createUser({
        username: 'newuser',
        password: 'pass',
        role: 'viewer',
        workspaceId: 'ws-1',
      })
    })

    expect(apiFetch).toHaveBeenCalledWith('/users', expect.objectContaining({ method: 'POST' }))
  })

  it('seeds logs from audit trail on first load', async () => {
    const auditEntries = [
      { event: 'spawn', ts: '2025-01-01T10:00:00Z', metadata: { name: 'test' } },
      { event: 'scan', ts: '2025-01-01T09:00:00Z', metadata: {} },
    ]

    apiFetch.mockImplementation(async (path) => {
      if (path === '/audit?limit=200') return mockOk(auditEntries)
      if (path === '/repos') return mockOk([])
      if (path === '/category-sizes') return mockOk({})
      return mockOk([])
    })

    renderData({ isFirstRun: false })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    await waitFor(() => {
      expect(Number(screen.getByTestId('logCount').textContent)).toBeGreaterThan(0)
    })
  })

  it('normalizes category sizes to lowercase keys', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/category-sizes') {
        return mockOk({ AI: 1500, Web: 3000, Infra: 200 })
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: false }, (d) => { dataRef = d })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    await waitFor(() => {
      expect(dataRef.categorySizes).toEqual({ ai: 1500, web: 3000, infra: 200 })
    })
  })

  it('enriches repos with Purpose from Category or parent folder', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/repos') {
        return mockOk([
          { Name: 'repo1', Path: '/repos/ai/repo1', Category: 'ML' },
          { Name: 'repo2', Path: '/repos/web/repo2' },
        ])
      }
      return mockOk([])
    })

    let dataRef
    renderData({ isFirstRun: false }, (d) => { dataRef = d })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    await waitFor(() => {
      expect(dataRef.repos.length).toBe(2)
    })
    expect(dataRef.repos[0].Purpose).toBe('ML')
    expect(dataRef.repos[1].Purpose).toBe('Web')
  })
})
