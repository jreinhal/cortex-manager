import { render, screen, act, waitFor } from '@testing-library/react'
import { WorkspaceProvider, useWorkspace } from '../contexts/WorkspaceContext'

// Mock apiFetch
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '../lib/api'

function WorkspaceConsumer({ onWorkspace }) {
  const ws = useWorkspace()
  onWorkspace?.(ws)
  return (
    <div>
      <span data-testid="count">{ws.workspaces.length}</span>
      <span data-testid="active">{ws.activeWorkspace?.name || 'none'}</span>
      <span data-testid="activeId">{ws.activeWorkspace?.id || 'none'}</span>
    </div>
  )
}

function renderWorkspace(onWorkspace) {
  return render(
    <WorkspaceProvider>
      <WorkspaceConsumer onWorkspace={onWorkspace} />
    </WorkspaceProvider>,
  )
}

describe('WorkspaceContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    apiFetch.mockReset()
  })

  it('throws when useWorkspace is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<WorkspaceConsumer />)).toThrow(
      'useWorkspace must be used within a WorkspaceProvider',
    )
    spy.mockRestore()
  })

  it('initializes with empty workspaces and null active', () => {
    renderWorkspace()
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('active').textContent).toBe('none')
  })

  it('fetchWorkspaces populates list and active workspace', async () => {
    const workspaceList = [
      { id: 'ws-1', name: 'Default' },
      { id: 'ws-2', name: 'Testing' },
    ]
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: workspaceList[0],
        workspaces: workspaceList,
      }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.fetchWorkspaces()
    })

    expect(screen.getByTestId('count').textContent).toBe('2')
    expect(screen.getByTestId('active').textContent).toBe('Default')
    expect(window.localStorage.getItem('cortex_workspace_id')).toBe('ws-1')
  })

  it('fetchWorkspaces does not overwrite existing localStorage', async () => {
    window.localStorage.setItem('cortex_workspace_id', 'ws-existing')

    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: { id: 'ws-1', name: 'Default' },
        workspaces: [{ id: 'ws-1', name: 'Default' }],
      }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.fetchWorkspaces()
    })

    // Should keep existing localStorage value
    expect(window.localStorage.getItem('cortex_workspace_id')).toBe('ws-existing')
  })

  it('handleWorkspaceSwitch updates active and calls onSwitch', async () => {
    const workspaceList = [
      { id: 'ws-1', name: 'Default' },
      { id: 'ws-2', name: 'Testing' },
    ]
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: workspaceList[0],
        workspaces: workspaceList,
      }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.fetchWorkspaces()
    })

    expect(screen.getByTestId('active').textContent).toBe('Default')

    const switchCallback = vi.fn()
    act(() => {
      wsRef.handleWorkspaceSwitch('ws-2', switchCallback)
    })

    expect(screen.getByTestId('active').textContent).toBe('Testing')
    expect(window.localStorage.getItem('cortex_workspace_id')).toBe('ws-2')
    expect(switchCallback).toHaveBeenCalledOnce()
  })

  it('handleWorkspaceSwitch does nothing with null id', async () => {
    const switchCallback = vi.fn()
    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    act(() => {
      wsRef.handleWorkspaceSwitch(null, switchCallback)
    })

    expect(switchCallback).not.toHaveBeenCalled()
  })

  it('createWorkspace calls API and refreshes', async () => {
    // First call: create workspace
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    // Second call: refresh (fetchWorkspaces)
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: { id: 'ws-1', name: 'Default' },
        workspaces: [
          { id: 'ws-1', name: 'Default' },
          { id: 'ws-new', name: 'New WS' },
        ],
      }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.createWorkspace({ name: 'New WS' })
    })

    expect(apiFetch).toHaveBeenCalledWith('/workspaces', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'New WS' }),
    }))
  })

  it('updateWorkspace calls API with PUT', async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: null, workspaces: [] }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.updateWorkspace('ws-1', { name: 'Renamed' })
    })

    expect(apiFetch).toHaveBeenCalledWith('/workspaces/ws-1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ name: 'Renamed' }),
    }))
  })

  it('deleteWorkspace calls API with DELETE after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: null, workspaces: [] }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.deleteWorkspace('ws-1')
    })

    expect(window.confirm).toHaveBeenCalledWith('Delete this workspace?')
    expect(apiFetch).toHaveBeenCalledWith('/workspaces/ws-1', { method: 'DELETE' })
  })

  it('deleteWorkspace does nothing when user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.deleteWorkspace('ws-1')
    })

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('setDefaultWorkspace calls API and refreshes', async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: null, workspaces: [] }),
    })

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.setDefaultWorkspace('ws-1')
    })

    expect(apiFetch).toHaveBeenCalledWith('/workspaces/ws-1/default', { method: 'POST' })
  })

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    apiFetch.mockRejectedValueOnce(new Error('Network error'))

    let wsRef
    renderWorkspace((ws) => { wsRef = ws })

    await act(async () => {
      await wsRef.fetchWorkspaces()
    })

    // Should remain at initial state
    expect(screen.getByTestId('count').textContent).toBe('0')
    consoleSpy.mockRestore()
  })
})
