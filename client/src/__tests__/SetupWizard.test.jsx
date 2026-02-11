import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SetupWizard } from '../views/SetupWizard'

// Mock apiFetch
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

// Mock DirectoryBrowser
vi.mock('../components/DirectoryBrowser', () => ({
  DirectoryBrowser: ({ isOpen, onClose, onSelect }) =>
    isOpen ? (
      <div data-testid="dir-browser">
        <button data-testid="dir-select" onClick={() => onSelect('/selected/path')}>
          Select
        </button>
        <button data-testid="dir-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}))

import { apiFetch } from '../lib/api'

describe('SetupWizard', () => {
  const defaultProps = {
    onComplete: vi.fn(),
    defaultPath: '',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.onComplete = vi.fn()
  })

  it('renders welcome heading', () => {
    render(<SetupWizard {...defaultProps} />)
    expect(screen.getByText('Welcome to CORTEX')).toBeTruthy()
  })

  it('renders repository root input', () => {
    render(<SetupWizard {...defaultProps} />)
    expect(screen.getByPlaceholderText(/repos/i)).toBeTruthy()
  })

  it('pre-fills defaultPath', () => {
    render(<SetupWizard {...defaultProps} defaultPath="/my/repos" />)
    const input = screen.getByPlaceholderText(/repos/i)
    expect(input.value).toBe('/my/repos')
  })

  it('submit button is disabled when no path entered', () => {
    render(<SetupWizard {...defaultProps} />)
    const btn = screen.getByRole('button', { name: /initialize cortex/i })
    expect(btn.disabled).toBe(true)
  })

  it('submit button is enabled when path is set', () => {
    render(<SetupWizard {...defaultProps} defaultPath="/repos" />)
    const btn = screen.getByRole('button', { name: /initialize cortex/i })
    expect(btn.disabled).toBe(false)
  })

  it('calls apiFetch and onComplete on successful submit', async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ success: true, config: {} }),
    })

    render(<SetupWizard {...defaultProps} defaultPath="/repos" />)
    fireEvent.click(screen.getByRole('button', { name: /initialize cortex/i }))

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalledWith({ success: true, config: {} })
    })
  })

  it('shows error on failed setup', async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Path not found' }),
    })

    render(<SetupWizard {...defaultProps} defaultPath="/bad/path" />)
    fireEvent.click(screen.getByRole('button', { name: /initialize cortex/i }))

    await waitFor(() => {
      expect(screen.getByText('Path not found')).toBeTruthy()
    })
    expect(defaultProps.onComplete).not.toHaveBeenCalled()
  })

  it('shows network error on fetch failure', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<SetupWizard {...defaultProps} defaultPath="/repos" />)
    fireEvent.click(screen.getByRole('button', { name: /initialize cortex/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to server.')).toBeTruthy()
    })
  })

  it('shows loading state during submit', async () => {
    let resolveSetup
    apiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSetup = resolve
      })
    )

    render(<SetupWizard {...defaultProps} defaultPath="/repos" />)
    fireEvent.click(screen.getByRole('button', { name: /initialize cortex/i }))

    expect(screen.getByText(/configuring/i)).toBeTruthy()

    // Resolve to clean up
    resolveSetup({ json: async () => ({ success: true }) })
    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled()
    })
  })

  it('opens directory browser on browse button click', () => {
    render(<SetupWizard {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Browse directories'))
    expect(screen.getByTestId('dir-browser')).toBeTruthy()
  })

  it('sets path when directory is selected from browser', () => {
    // Mock validate-path call
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ exists: true }),
    })

    render(<SetupWizard {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Browse directories'))
    fireEvent.click(screen.getByTestId('dir-select'))

    const input = screen.getByPlaceholderText(/repos/i)
    expect(input.value).toBe('/selected/path')
  })

  it('validates path on blur', async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ exists: true }),
    })

    render(<SetupWizard {...defaultProps} />)
    const input = screen.getByPlaceholderText(/repos/i)
    fireEvent.change(input, { target: { value: '/my/path' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText('Directory exists')).toBeTruthy()
    })
  })

  it('shows "will be created" for non-existing path', async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ exists: false }),
    })

    render(<SetupWizard {...defaultProps} />)
    const input = screen.getByPlaceholderText(/repos/i)
    fireEvent.change(input, { target: { value: '/new/path' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText('Directory will be created')).toBeTruthy()
    })
  })

  it('has create structure checkbox checked by default', () => {
    render(<SetupWizard {...defaultProps} />)
    expect(screen.getByText(/create folder structure/i)).toBeTruthy()
  })
})
