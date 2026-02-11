import { render, screen, fireEvent } from '@testing-library/react'
import { RunsView } from '../views/RunsView'

const makeRun = (overrides = {}) => ({
  id: `run-${Math.random().toString(36).slice(2, 8)}`,
  goal: 'Test run goal',
  format: 'universal',
  timestamp: '2025-01-15T10:00:00Z',
  durationMs: 3500,
  metrics: { qualityScore: 8, tokensEstimated: 1200, costEstimated: 0.05, currency: 'USD' },
  agent: { name: 'codegen', id: 'codegen-v1' },
  decisionMatrix: {},
  performance: { totalMs: 3500, spans: [] },
  trace: { steps: [] },
  ...overrides,
})

describe('RunsView', () => {
  const defaultProps = {
    runs: [],
    apiFetch: vi.fn(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.apiFetch = vi.fn()
  })

  it('renders empty state when no runs', () => {
    render(<RunsView {...defaultProps} />)
    expect(screen.getByText('Select a run')).toBeTruthy()
  })

  it('renders run list', () => {
    const runs = [
      makeRun({ id: 'r1', goal: 'Build API' }),
      makeRun({ id: 'r2', goal: 'Fix tests' }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)
    // Goals appear in list, detail panel (auto-selected), AND comparison <select> <option> elements
    expect(screen.getAllByText('Build API').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Fix tests').length).toBeGreaterThanOrEqual(1)
  })

  it('shows run count', () => {
    const runs = [makeRun(), makeRun(), makeRun()]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('3 total')).toBeTruthy()
  })

  it('auto-selects first run and shows its detail', () => {
    const runs = [makeRun({ id: 'r1', goal: 'First run', agent: { name: 'codegen' } })]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('Run Detail')).toBeTruthy()
    // Goal appears in both list and detail panel
    expect(screen.getAllByText('First run').length).toBeGreaterThanOrEqual(1)
  })

  it('shows run detail fields (agent, format)', () => {
    const runs = [
      makeRun({
        id: 'r1',
        goal: 'Detail test',
        agent: { name: 'research' },
        format: 'markdown',
      }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('research')).toBeTruthy()
    expect(screen.getByText('markdown')).toBeTruthy()
  })

  it('filters runs by search query', () => {
    const runs = [
      makeRun({ id: 'r1', goal: 'Build API' }),
      makeRun({ id: 'r2', goal: 'Fix tests' }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)
    const searchInput = screen.getByPlaceholderText('Search runs…')
    fireEvent.change(searchInput, { target: { value: 'Build' } })

    expect(screen.getAllByText('Build API').length).toBeGreaterThanOrEqual(1)
    // 'Fix tests' may still appear in comparison <select> <option> (uses full runs array).
    // Verify it's no longer in the filtered run list by checking the list buttons.
    const runButtons = screen.getAllByRole('button').filter((btn) => btn.textContent.includes('Fix tests'))
    // The filtered list should not have a clickable run button for 'Fix tests'
    // (any remaining match would be in the comparison select, not a button)
    const listButtons = runButtons.filter((btn) => btn.closest('[data-testid="run-list"]') || btn.closest('.space-y-2'))
    expect(listButtons.length).toBe(0)
  })

  it('shows empty state for no search matches', () => {
    const runs = [makeRun({ id: 'r1', goal: 'Build API' })]
    render(<RunsView {...defaultProps} runs={runs} />)
    const searchInput = screen.getByPlaceholderText('Search runs…')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No runs match')).toBeTruthy()
  })

  it('switches selected run on click', () => {
    const runs = [
      makeRun({ id: 'r1', goal: 'First run' }),
      makeRun({ id: 'r2', goal: 'Second run', agent: { name: 'analyst' } }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)

    // Click the second run — its goal may appear in list+detail
    fireEvent.click(screen.getAllByText('Second run')[0])
    expect(screen.getByText('analyst')).toBeTruthy()
  })

  it('renders performance spans when present', () => {
    const runs = [
      makeRun({
        id: 'r1',
        goal: 'Perf test',
        performance: {
          totalMs: 5000,
          spans: [
            { name: 'agent_selection', durationMs: 2000 },
            { name: 'knowledge_retrieval', durationMs: 3000 },
          ],
        },
      }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('agent selection')).toBeTruthy()
    expect(screen.getByText('knowledge retrieval')).toBeTruthy()
  })

  it('renders trace steps when present', () => {
    const runs = [
      makeRun({
        id: 'r1',
        goal: 'Trace test',
        trace: {
          steps: [
            { name: 'init', data: { status: 'ok' } },
            { name: 'analyze', data: { keywords: 3 } },
          ],
        },
      }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('init')).toBeTruthy()
    expect(screen.getByText('analyze')).toBeTruthy()
  })

  it('renders decision matrix section', () => {
    const runs = [makeRun({ id: 'r1', goal: 'Matrix test' })]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('Decision Matrix')).toBeTruthy()
  })

  it('renders git context when present', () => {
    const runs = [
      makeRun({
        id: 'r1',
        goal: 'Git test',
        git: {
          branch: 'main',
          commit: 'abc12345678',
          dirty: false,
          message: 'Initial commit',
        },
      }),
    ]
    render(<RunsView {...defaultProps} runs={runs} />)
    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByText('abc12345')).toBeTruthy()
    expect(screen.getByText('Clean')).toBeTruthy()
  })
})
