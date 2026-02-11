import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { NavItem } from '../components/NavItem'
import { Sparkline } from '../components/Sparkline'
import { Database } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items" />)
    expect(screen.getByText('No items')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<EmptyState title="No items" subtitle="Add some items to get started." />)
    expect(screen.getByText('Add some items to get started.')).toBeTruthy()
  })

  it('does not render subtitle when not provided', () => {
    const { container } = render(<EmptyState title="No items" />)
    const subtitleEl = container.querySelector('.text-xs')
    expect(subtitleEl).toBeNull()
  })
})

describe('NavItem', () => {
  function renderNavItem(props = {}) {
    return render(
      <MemoryRouter>
        <NavItem icon={Database} label="Knowledge" to="/knowledge" {...props} />
      </MemoryRouter>
    )
  }

  it('renders label text', () => {
    renderNavItem()
    expect(screen.getByText('Knowledge')).toBeTruthy()
  })

  it('renders as a link with correct href', () => {
    renderNavItem()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/knowledge')
  })

  it('sets aria-current when active', () => {
    renderNavItem({ active: true })
    const link = screen.getByRole('link')
    expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('does not set aria-current when inactive', () => {
    renderNavItem({ active: false })
    const link = screen.getByRole('link')
    expect(link.getAttribute('aria-current')).toBeNull()
  })

  it('renders badge when provided', () => {
    renderNavItem({ badge: '42' })
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('sets data-testid when provided', () => {
    renderNavItem({ testId: 'nav-knowledge' })
    expect(screen.getByTestId('nav-knowledge')).toBeTruthy()
  })
})

describe('Sparkline', () => {
  it('renders SVG with valid data', () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    const path = container.querySelector('path')
    expect(path).toBeTruthy()
    expect(path.getAttribute('d')).toContain('M')
  })

  it('renders "No data" with empty array', () => {
    render(<Sparkline values={[]} />)
    expect(screen.getByText('No data')).toBeTruthy()
  })

  it('uses custom stroke color', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} stroke="#ff0000" />)
    const path = container.querySelector('path')
    expect(path.getAttribute('stroke')).toBe('#ff0000')
  })
})
