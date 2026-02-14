/* global beforeEach, describe, expect, it, vi */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SettingsPanel } from '../views/SettingsPanel'

function createProps(overrides = {}) {
  return {
    config: {
      config: {
        reposRoot: 'D:\\Projects\\reference-repos',
        auth: { enabled: true },
        workspaces: { defaultId: 'ws-1', items: [] },
      },
    },
    onSave: vi.fn(),
    uiTheme: 'system',
    onThemeChange: vi.fn(),
    authStatus: { enabled: true },
    authUser: { role: 'admin' },
    users: [],
    onCreateUser: vi.fn(),
    onUpdateUser: vi.fn(),
    onDeleteUser: vi.fn(),
    vectorStatus: {},
    onRebuildVector: vi.fn(),
    workspaces: [
      { id: 'ws-1', name: 'Primary', reposRoot: 'D:\\Repos\\Primary', outputDir: 'D:\\Output\\Primary' },
      { id: 'ws-2', name: 'Secondary', reposRoot: 'D:\\Repos\\Secondary', outputDir: '' },
    ],
    activeWorkspace: { id: 'ws-1' },
    onCreateWorkspace: vi.fn(),
    onUpdateWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onSetDefaultWorkspace: vi.fn(),
    apiFetch: vi.fn(),
    cn: (...classes) => classes.filter(Boolean).join(' '),
    defaultRbacRoles: {},
    manualUrl: '/manual/index.html',
    transition: { duration: 0 },
    ...overrides,
  }
}

describe('SettingsPanel workspace actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a workspace with form values', async () => {
    const props = createProps()
    render(<SettingsPanel {...props} />)

    fireEvent.change(screen.getByPlaceholderText('Workspace name'), { target: { value: ' New Workspace ' } })
    fireEvent.change(screen.getByPlaceholderText('Repos root'), { target: { value: ' D:\\Repos\\New ' } })
    fireEvent.change(screen.getByPlaceholderText('Output directory (optional)'), { target: { value: ' D:\\Output\\New ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))

    await waitFor(() => {
      expect(props.onCreateWorkspace).toHaveBeenCalledWith({
        name: 'New Workspace',
        reposRoot: 'D:\\Repos\\New',
        outputDir: 'D:\\Output\\New',
        createStructure: true,
      })
    })
  })

  it('shows validation error when workspace repos root is empty', async () => {
    const props = createProps()
    render(<SettingsPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))

    await waitFor(() => {
      expect(props.onCreateWorkspace).not.toHaveBeenCalled()
    })
    expect(screen.getByText('Workspace repos root cannot be empty')).toBeTruthy()
  })

  it('edits an existing workspace and sends update payload', async () => {
    const props = createProps()
    render(<SettingsPanel {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getByPlaceholderText('Workspace name'), { target: { value: 'Primary Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(props.onUpdateWorkspace).toHaveBeenCalledWith('ws-1', {
        name: 'Primary Updated',
        reposRoot: 'D:\\Repos\\Primary',
        outputDir: 'D:\\Output\\Primary',
        createStructure: false,
      })
    })

    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeTruthy()
  })

  it('resets workspace form when canceling edit', async () => {
    const props = createProps()
    render(<SettingsPanel {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1])
    fireEvent.change(screen.getByPlaceholderText('Workspace name'), { target: { value: 'Temporary Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create workspace' })).toBeTruthy()
    })
    expect(screen.getByPlaceholderText('Workspace name').value).toBe('')
    expect(screen.getByPlaceholderText('Repos root').value).toBe('')
  })
})
