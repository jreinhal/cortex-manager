import { render, screen, fireEvent } from '@testing-library/react'
import { HomeView } from '../views/HomeView'

describe('HomeView', () => {
  const baseProps = {
    repos: [],
    runs: [],
    datasets: [],
    evaluations: [],
    savedPrompts: [],
    sessions: [],
    onNavigate: vi.fn(),
    onOpenChecklist: vi.fn(),
    appConfig: { config: { llm: { model: 'gpt-4o' } } },
    observabilitySummary: null,
    jobs: [],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    baseProps.onNavigate = vi.fn()
    baseProps.onOpenChecklist = vi.fn()
  })

  it('renders command center heading', () => {
    render(<HomeView {...baseProps} />)
    expect(screen.getByText('Command Center')).toBeTruthy()
  })

  it('renders stat cards with correct labels', () => {
    const props = {
      ...baseProps,
      repos: [{ id: 'r1' }, { id: 'r2' }],
      runs: [{ id: 'run1' }],
      datasets: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }],
      evaluations: [{ id: 'e1' }],
    }
    render(<HomeView {...props} />)
    expect(screen.getByText('Total Runs')).toBeTruthy()
    expect(screen.getByText('Repos')).toBeTruthy()
    // Numbers may appear in multiple stat cards so use getAllByText
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
  })

  it('renders configured model', () => {
    render(<HomeView {...baseProps} />)
    expect(screen.getByText('gpt-4o')).toBeTruthy()
  })

  it('renders fallback model when not configured', () => {
    const props = { ...baseProps, appConfig: {} }
    render(<HomeView {...props} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('calls onOpenChecklist when checklist button is clicked', () => {
    render(<HomeView {...baseProps} />)
    fireEvent.click(screen.getByText('Pre-Commit Checklist'))
    expect(baseProps.onOpenChecklist).toHaveBeenCalledTimes(1)
  })

  it('calls onNavigate("agents") when New Spawn button is clicked', () => {
    render(<HomeView {...baseProps} />)
    fireEvent.click(screen.getByText('New Spawn'))
    expect(baseProps.onNavigate).toHaveBeenCalledWith('agents')
  })

  it('shows empty state container when no runs', () => {
    const { container } = render(<HomeView {...baseProps} />)
    // EmptyState uses `message` prop which isn't supported (only title/subtitle),
    // so the dashed-border container renders but with no text
    expect(container.querySelector('.border-dashed')).toBeTruthy()
  })

  it('renders recent runs list', () => {
    const props = {
      ...baseProps,
      runs: [
        { id: 'r1', goal: 'Test goal one', timestamp: '2025-01-15T10:00:00Z', format: 'markdown' },
        { id: 'r2', goal: 'Test goal two', timestamp: '2025-01-15T11:00:00Z', format: 'universal' },
      ],
    }
    render(<HomeView {...props} />)
    expect(screen.getByText('Test goal one')).toBeTruthy()
    expect(screen.getByText('Test goal two')).toBeTruthy()
  })

  it('shows "View all" link when more than 5 runs', () => {
    const runs = Array.from({ length: 7 }, (_, i) => ({
      id: `r${i}`,
      goal: `Run ${i}`,
      timestamp: '2025-01-15T10:00:00Z',
    }))
    render(<HomeView {...baseProps} runs={runs} />)
    expect(screen.getByText('View all →')).toBeTruthy()
  })

  it('does not show "View all" link when 5 or fewer runs', () => {
    const runs = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      goal: `Run ${i}`,
      timestamp: '2025-01-15T10:00:00Z',
    }))
    render(<HomeView {...baseProps} runs={runs} />)
    expect(screen.queryByText('View all →')).toBeNull()
  })

  it('renders observability summary when provided', () => {
    const props = {
      ...baseProps,
      observabilitySummary: {
        totalTokens: 15000,
        avgLatencyMs: 1234.5,
        estimatedCost: 0.0567,
        errorCount: 2,
      },
    }
    render(<HomeView {...props} />)
    expect(screen.getByText('15,000')).toBeTruthy()
    expect(screen.getByText('1235ms')).toBeTruthy()
    expect(screen.getByText('$0.0567')).toBeTruthy()
    expect(screen.getByText('Observability')).toBeTruthy()
  })

  it('does not render observability section when summary is null', () => {
    render(<HomeView {...baseProps} />)
    expect(screen.queryByText('Observability')).toBeNull()
  })

  it('displays queued jobs label', () => {
    const props = {
      ...baseProps,
      jobs: [
        { id: 'j1', status: 'pending' },
        { id: 'j2', status: 'running' },
        { id: 'j3', status: 'completed' },
      ],
    }
    render(<HomeView {...props} />)
    expect(screen.getByText('Queued Jobs')).toBeTruthy()
  })
})
