import { render, screen, fireEvent } from '@testing-library/react'
import { JobsView } from '../views/JobsView'

const makeJob = (overrides = {}) => ({
  id: `job-${Math.random().toString(36).slice(2, 8)}`,
  type: 'vector-index',
  status: 'pending',
  createdAt: '2025-01-15T10:00:00Z',
  durationMs: null,
  error: null,
  ...overrides,
})

describe('JobsView', () => {
  const defaultProps = {
    jobs: [],
    onCancelJob: vi.fn(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    defaultProps.onCancelJob = vi.fn()
  })

  it('renders empty state when no jobs', () => {
    const { container } = render(<JobsView {...defaultProps} />)
    // EmptyState renders but `message` prop isn't supported (only title/subtitle),
    // so just check the empty state container is present (dashed border)
    expect(container.querySelector('.border-dashed')).toBeTruthy()
  })

  it('renders job list items', () => {
    const jobs = [
      makeJob({ type: 'vector-index', status: 'completed' }),
      makeJob({ type: 'scan-repos', status: 'running' }),
    ]
    render(<JobsView {...defaultProps} jobs={jobs} />)
    expect(screen.getByText('vector-index')).toBeTruthy()
    expect(screen.getByText('scan-repos')).toBeTruthy()
  })

  it('shows job detail panel when a job is selected', () => {
    const jobs = [
      makeJob({ id: 'j1', type: 'vector-index', status: 'completed', durationMs: 5000 }),
    ]
    render(<JobsView {...defaultProps} jobs={jobs} />)

    // Click the job button
    fireEvent.click(screen.getByText('vector-index'))

    // Detail panel shows status — appears in both list badge and detail, so use getAllByText
    const completedElements = screen.getAllByText('completed')
    expect(completedElements.length).toBeGreaterThanOrEqual(2)
  })

  it('shows cancel button for pending/running jobs', () => {
    const jobs = [makeJob({ id: 'j1', type: 'reindex', status: 'running' })]
    render(<JobsView {...defaultProps} jobs={jobs} />)
    fireEvent.click(screen.getByText('reindex'))

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    expect(cancelBtn).toBeTruthy()
    fireEvent.click(cancelBtn)
    expect(defaultProps.onCancelJob).toHaveBeenCalledWith('j1')
  })

  it('does not show cancel button for completed jobs', () => {
    const jobs = [makeJob({ id: 'j1', type: 'build', status: 'completed' })]
    render(<JobsView {...defaultProps} jobs={jobs} />)
    fireEvent.click(screen.getByText('build'))

    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
  })

  it('shows error in detail panel when job has error', () => {
    const jobs = [makeJob({ id: 'j1', type: 'fail-job', status: 'failed', error: 'Timed out' })]
    render(<JobsView {...defaultProps} jobs={jobs} />)
    fireEvent.click(screen.getByText('fail-job'))

    expect(screen.getByText('Timed out')).toBeTruthy()
  })

  it('displays job status badges in list', () => {
    const jobs = [
      makeJob({ type: 'job-a', status: 'completed' }),
      makeJob({ type: 'job-b', status: 'failed' }),
      makeJob({ type: 'job-c', status: 'pending' }),
    ]
    render(<JobsView {...defaultProps} jobs={jobs} />)
    // Each status appears at least once in the list badges
    expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('failed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('pending').length).toBeGreaterThanOrEqual(1)
  })
})
