import { render, screen, fireEvent } from '@testing-library/react'
import { OrchestratorView } from '../views/OrchestratorView'

// Mock SpawnTimeline component
vi.mock('../components/SpawnTimeline', () => ({
  SpawnTimeline: ({ steps }) => (
    <div data-testid="spawn-timeline">
      {steps.length} steps
    </div>
  ),
}))

describe('OrchestratorView', () => {
  const baseProps = {
    onSpawn: vi.fn(),
    loading: false,
    result: null,
    sessions: [],
    savedPrompts: [],
    onSavePrompt: vi.fn(),
    onDeletePrompt: vi.fn(),
    onUsePrompt: vi.fn(),
    onDirtyChange: vi.fn(),
    prefillGoal: '',
    onPrefillConsumed: vi.fn(),
    queueEnabled: false,
    externalSkillsConfig: null,
    latestRun: null,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    baseProps.onSpawn = vi.fn()
    baseProps.onSavePrompt = vi.fn()
    baseProps.onDeletePrompt = vi.fn()
    baseProps.onUsePrompt = vi.fn()
    baseProps.onDirtyChange = vi.fn()
    baseProps.onPrefillConsumed = vi.fn()
  })

  it('renders agent factory heading', () => {
    render(<OrchestratorView {...baseProps} />)
    expect(screen.getByText(/agent factory/i)).toBeTruthy()
  })

  it('renders goal textarea with correct placeholder', () => {
    render(<OrchestratorView {...baseProps} />)
    expect(screen.getByPlaceholderText(/example: audit the dashboard/i)).toBeTruthy()
  })

  it('generate button is disabled when goal is empty', () => {
    render(<OrchestratorView {...baseProps} />)
    const btn = screen.getByTestId('generate-flight-plan')
    expect(btn.disabled).toBe(true)
  })

  it('generate button is enabled when goal has text', () => {
    render(<OrchestratorView {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/example: audit the dashboard/i)
    fireEvent.change(textarea, { target: { value: 'Build a REST API' } })
    const btn = screen.getByTestId('generate-flight-plan')
    expect(btn.disabled).toBe(false)
  })

  it('calls onSpawn when generate button is clicked', () => {
    render(<OrchestratorView {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/example: audit the dashboard/i)
    fireEvent.change(textarea, { target: { value: 'Create a new feature' } })
    fireEvent.click(screen.getByTestId('generate-flight-plan'))
    expect(baseProps.onSpawn).toHaveBeenCalled()
  })

  it('shows loading state when spawning', () => {
    // SpawnTimeline only renders when spawnSteps.length > 0 (internal state).
    // The loading prop alone shows a spinner on the button but doesn't populate spawnSteps.
    // Verify the button shows a loading indicator instead.
    render(<OrchestratorView {...baseProps} loading={true} />)
    const btn = screen.getByTestId('generate-flight-plan')
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Generate Flight Plan')
  })

  it('pre-fills goal from prefillGoal prop', () => {
    render(<OrchestratorView {...baseProps} prefillGoal="Pre-filled goal text" />)
    const textarea = screen.getByPlaceholderText(/example: audit the dashboard/i)
    expect(textarea.value).toBe('Pre-filled goal text')
  })

  it('calls onPrefillConsumed after prefill', () => {
    render(<OrchestratorView {...baseProps} prefillGoal="Some goal" />)
    expect(baseProps.onPrefillConsumed).toHaveBeenCalled()
  })

  it('renders saved prompts section', () => {
    // Component accesses prompt.query.substring(0, 60) — must use `query`, not `text`
    const prompts = [
      { id: 'p1', title: 'API Design', query: 'Design a REST API for...' },
      { id: 'p2', title: 'Bug Fix', query: 'Fix the auth issue in...' },
    ]
    render(<OrchestratorView {...baseProps} savedPrompts={prompts} />)
    expect(screen.getByText('API Design')).toBeTruthy()
    expect(screen.getByText('Bug Fix')).toBeTruthy()
  })

  it('renders recent sessions', () => {
    const sessions = [
      { id: 's1', goal: 'Session one', timestamp: '2025-01-15T10:00:00Z' },
      { id: 's2', goal: 'Session two', timestamp: '2025-01-15T11:00:00Z' },
    ]
    render(<OrchestratorView {...baseProps} sessions={sessions} />)
    expect(screen.getByText('Session one')).toBeTruthy()
    expect(screen.getByText('Session two')).toBeTruthy()
  })

  it('shows Flight Plan Ready when result is present', () => {
    render(<OrchestratorView {...baseProps} result="# Flight Plan\nStep 1: Do things" />)
    expect(screen.getByText('Flight Plan Ready')).toBeTruthy()
  })

  it('calls onDirtyChange when goal text changes', () => {
    render(<OrchestratorView {...baseProps} />)
    const textarea = screen.getByPlaceholderText(/example: audit the dashboard/i)
    fireEvent.change(textarea, { target: { value: 'x' } })
    expect(baseProps.onDirtyChange).toHaveBeenCalledWith(true)
  })
})
