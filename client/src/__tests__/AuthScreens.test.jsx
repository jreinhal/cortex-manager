import { render, screen, fireEvent } from '@testing-library/react'
import { LoginScreen, BootstrapAdminScreen } from '../views/AuthScreens'

// Mock the brain icon asset
vi.mock('../assets/brain.png', () => ({ default: 'brain.png' }))

describe('LoginScreen', () => {
  const defaultProps = {
    onLogin: vi.fn(),
    loading: false,
    error: null,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.onLogin = vi.fn()
  })

  it('renders sign in heading', () => {
    render(<LoginScreen {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeTruthy()
  })

  it('renders username and password inputs', () => {
    render(<LoginScreen {...defaultProps} />)
    expect(screen.getByPlaceholderText('Username')).toBeTruthy()
    expect(screen.getByPlaceholderText('Password')).toBeTruthy()
  })

  it('submit button is disabled when fields are empty', () => {
    render(<LoginScreen {...defaultProps} />)
    const btn = screen.getByRole('button', { name: /sign in/i })
    expect(btn.disabled).toBe(true)
  })

  it('calls onLogin with username and password on submit', () => {
    render(<LoginScreen {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'bob' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(defaultProps.onLogin).toHaveBeenCalledWith('bob', 'secret')
  })

  it('shows loading state', () => {
    render(<LoginScreen {...defaultProps} loading={true} />)
    expect(screen.getByRole('button', { name: /signing in/i })).toBeTruthy()
  })

  it('displays error message', () => {
    render(<LoginScreen {...defaultProps} error="Invalid credentials" />)
    expect(screen.getByText('Invalid credentials')).toBeTruthy()
  })
})

describe('BootstrapAdminScreen', () => {
  const defaultProps = {
    onBootstrap: vi.fn(),
    loading: false,
    error: null,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.onBootstrap = vi.fn()
  })

  it('renders create admin title', () => {
    render(<BootstrapAdminScreen {...defaultProps} />)
    expect(screen.getByText('Create Admin Account')).toBeTruthy()
  })

  it('submit button disabled when empty', () => {
    render(<BootstrapAdminScreen {...defaultProps} />)
    const btn = screen.getByRole('button', { name: /create admin/i })
    expect(btn.disabled).toBe(true)
  })

  it('calls onBootstrap with credentials on submit', () => {
    render(<BootstrapAdminScreen {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Admin username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: /create admin/i }))
    expect(defaultProps.onBootstrap).toHaveBeenCalledWith('admin', 'pw')
  })

  it('shows loading state', () => {
    render(<BootstrapAdminScreen {...defaultProps} loading={true} />)
    expect(screen.getByRole('button', { name: /creating/i })).toBeTruthy()
  })

  it('displays error message', () => {
    render(<BootstrapAdminScreen {...defaultProps} error="Server error" />)
    expect(screen.getByText('Server error')).toBeTruthy()
  })
})
